// Custom Face Upload API
// POST /api/agents/[id]/face — Upload photo to create custom Simli avatar
// DELETE /api/agents/[id]/face — Remove custom face, revert to preset

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAgent, updateAgent } from '@/lib/db';

// Increase timeout for image processing + external API calls
export const maxDuration = 60;

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

async function authenticateAndGetAgent(agentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 };

  const agent = await getAgent(agentId);
  if (!agent) return { error: 'Agent not found', status: 404 };
  if (agent.user_id !== user.id) return { error: 'Forbidden', status: 403 };

  return { user, agent };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await authenticateAndGetAgent(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    if (!SIMLI_API_KEY) {
      return NextResponse.json({ error: 'Simli API key not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const consent = formData.get('consent');

    if (consent !== 'true') {
      return NextResponse.json({ error: 'Consent is required' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    // Validate file type (JPEG, PNG, WEBP)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, and WEBP images are allowed' }, { status: 400 });
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be smaller than 5MB' }, { status: 400 });
    }

    // Image is already resized to 1024x1024 square JPEG by the frontend (Canvas API)
    // No sharp needed — saves ~5s of server processing time
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Set status to uploading
    await updateAgent(id, { custom_face_status: 'uploading' });

    // Upload to Supabase Storage
    const ext = 'jpg';
    const storagePath = `${id}/face.${ext}`;
    const admin = createAdminClient();

    // Remove old file if exists
    await admin.storage.from('agent-faces').remove([`${id}/face.jpg`, `${id}/face.png`]);

    const { error: uploadError } = await admin.storage
      .from('agent-faces')
      .upload(storagePath, new Uint8Array(fileBuffer), {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Face Upload] Storage error:', uploadError);
      await updateAgent(id, { custom_face_status: 'failed' });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Generate a signed URL for the uploaded image (1 hour expiry)
    const { data: signedData } = await admin.storage
      .from('agent-faces')
      .createSignedUrl(storagePath, 3600);

    // CRITICAL: Always store the storage path in DB (not the signed URL which expires)
    // The signed URL is only returned to the frontend for immediate display
    const signedUrl = signedData?.signedUrl || null;

    // Call Simli API to create custom face
    const makeSimliForm = () => {
      const fd = new FormData();
      fd.append('image', new Blob([fileBuffer], { type: file.type || 'image/jpeg' }), `face.${ext}`);
      return fd;
    };

    const faceName = encodeURIComponent(result.agent.name || 'avatar');

    // Use Trinity endpoint ONLY — Legacy faces don't work with startAudioToVideoSession
    const simliResponse = await fetch(`https://api.simli.ai/faces/trinity?face_name=${faceName}`, {
      method: 'POST',
      headers: { 'x-simli-api-key': SIMLI_API_KEY },
      body: makeSimliForm(),
    });

    if (!simliResponse.ok) {
      const errorText = await simliResponse.text();
      console.error('[Face Upload] Trinity error:', simliResponse.status, errorText);
      await updateAgent(id, { custom_face_status: 'failed', custom_face_image_url: storagePath });

      let userError = 'Failed to create custom face. Please try again.';
      try {
        const parsed = JSON.parse(errorText);
        const detail = parsed.detail || parsed.message || parsed.error;
        if (detail) userError = typeof detail === 'string' ? detail : JSON.stringify(detail);
      } catch { /* use default */ }

      // Add helpful context for quota errors
      if (userError.includes('max number') || userError.includes('subscription')) {
        userError += ' Delete unused faces in Simli Studio to free up slots.';
      }

      return NextResponse.json({ error: userError }, { status: 502 });
    }

    const simliRawText = await simliResponse.text();
    console.log('[Face Upload] Simli response:', simliRawText);

    let simliData;
    try {
      simliData = JSON.parse(simliRawText);
    } catch {
      console.error('[Face Upload] Failed to parse Simli response');
      await updateAgent(id, { custom_face_status: 'failed', custom_face_image_url: storagePath });
      return NextResponse.json({ error: 'Unexpected response from avatar service' }, { status: 502 });
    }

    // Extract face ID from Trinity response (character_uid for legacy fallback)
    const faceId = simliData.face_id
      || simliData.faceId
      || simliData.character_uid
      || simliData.id
      || simliData.data?.face_id
      || simliData.data?.id;

    if (!faceId) {
      console.error('[Face Upload] No face_id in response:', JSON.stringify(simliData));
      await updateAgent(id, { custom_face_status: 'failed', custom_face_image_url: storagePath });
      return NextResponse.json(
        { error: simliData.detail || simliData.message || 'Avatar service did not return a face ID.' },
        { status: 502 }
      );
    }

    // Trinity faces need processing before they can be used
    const faceStatus = 'processing';

    // Save custom face data but DON'T change avatar_face_id yet
    // The avatar stays on the current preset while Trinity processes
    // avatar_face_id is updated when status becomes 'ready'
    await updateAgent(id, {
      custom_face_id: faceId,
      custom_face_status: faceStatus,
      custom_face_image_url: storagePath,
      face_consent_at: new Date().toISOString(),
    });

    console.log(`[Face Upload] Success: faceId=${faceId}, status=${faceStatus}`);

    return NextResponse.json({
      status: faceStatus,
      customFaceId: faceId,
      imageUrl: signedUrl, // Return signed URL to frontend for display
    });
  } catch (error) {
    console.error('[Face Upload] Error:', error);
    await updateAgent(id, { custom_face_status: 'failed' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await authenticateAndGetAgent(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    const admin = createAdminClient();
    await admin.storage.from('agent-faces').remove([`${id}/face.jpg`, `${id}/face.png`]);

    // Try to delete from provider (both Trinity and Legacy endpoints)
    if (SIMLI_API_KEY && result.agent.custom_face_id) {
      const faceId = result.agent.custom_face_id;
      const headers = { 'x-simli-api-key': SIMLI_API_KEY };
      await Promise.allSettled([
        fetch(`https://api.simli.ai/faces/trinity/${faceId}`, { method: 'DELETE', headers }),
        fetch(`https://api.simli.ai/faces/legacy/${faceId}`, { method: 'DELETE', headers }),
      ]);
    }

    await updateAgent(id, {
      custom_face_id: null,
      custom_face_status: 'none',
      custom_face_image_url: null,
      face_consent_at: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Face Delete] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
