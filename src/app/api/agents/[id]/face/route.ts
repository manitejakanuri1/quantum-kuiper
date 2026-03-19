// Custom Face Upload API
// POST /api/agents/[id]/face — Upload photo to create custom Simli avatar
// DELETE /api/agents/[id]/face — Remove custom face, revert to preset

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAgent, updateAgent } from '@/lib/db';

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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG and PNG images are allowed' }, { status: 400 });
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be smaller than 5MB' }, { status: 400 });
    }

    // Set status to uploading
    await updateAgent(id, { custom_face_status: 'uploading' });

    // Upload to Supabase Storage
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const storagePath = `${id}/face.${ext}`;
    const admin = createAdminClient();

    // Remove old file if exists
    await admin.storage.from('agent-faces').remove([`${id}/face.jpg`, `${id}/face.png`]);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from('agent-faces')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Face Upload] Storage error:', uploadError);
      await updateAgent(id, { custom_face_status: 'failed' });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('agent-faces').getPublicUrl(storagePath);
    const imageUrl = urlData.publicUrl;

    // Call Simli API to create custom face (Trinity endpoint)
    const simliFormData = new FormData();
    simliFormData.append('image', new Blob([fileBuffer], { type: file.type }), `face.${ext}`);

    let simliResponse = await fetch('https://api.simli.ai/faces/trinity?face_name=' + encodeURIComponent(result.agent.name), {
      method: 'POST',
      headers: {
        'x-simli-api-key': SIMLI_API_KEY,
      },
      body: simliFormData,
    });

    // Fall back to legacy endpoint if Trinity fails
    if (!simliResponse.ok) {
      const errorText = await simliResponse.text();
      console.error('[Face Upload] Simli Trinity API error:', simliResponse.status, errorText);

      simliResponse = await fetch('https://api.simli.ai/faces/legacy?face_name=' + encodeURIComponent(result.agent.name), {
        method: 'POST',
        headers: {
          'x-simli-api-key': SIMLI_API_KEY,
        },
        body: simliFormData,
      });

      if (!simliResponse.ok) {
        const legacyError = await simliResponse.text();
        console.error('[Face Upload] Simli Legacy API error:', simliResponse.status, legacyError);
        await updateAgent(id, { custom_face_status: 'failed' });
        return NextResponse.json(
          { error: 'Failed to create custom face. Please try again.' },
          { status: 502 }
        );
      }
    }

    const simliData = await simliResponse.json();
    const faceId = simliData.face_id || simliData.faceId || simliData.id;

    if (!faceId) {
      await updateAgent(id, { custom_face_status: 'failed' });
      return NextResponse.json({ error: 'Simli did not return a face ID' }, { status: 502 });
    }

    await updateAgent(id, {
      custom_face_id: faceId,
      custom_face_status: 'processing',
      custom_face_image_url: imageUrl,
      face_consent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      status: 'processing',
      customFaceId: faceId,
      imageUrl,
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
    // Remove files from storage
    const admin = createAdminClient();
    await admin.storage.from('agent-faces').remove([`${id}/face.jpg`, `${id}/face.png`]);

    // Reset custom face fields
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
