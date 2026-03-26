// Face Processing Status API
// GET /api/agents/[id]/face/status — Poll Simli for custom face processing status

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAgent, updateAgent } from '@/lib/db';

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getAgent(id);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // If already ready or no custom face, return current status
  if (agent.custom_face_status !== 'processing' || !agent.custom_face_id) {
    return NextResponse.json({
      status: agent.custom_face_status,
      customFaceId: agent.custom_face_id,
      imageUrl: agent.custom_face_image_url,
      uploadedAt: agent.face_consent_at,
    });
  }

  // Check Simli API for face generation status
  try {
    if (!SIMLI_API_KEY) {
      return NextResponse.json({
        status: agent.custom_face_status,
        customFaceId: agent.custom_face_id,
        imageUrl: agent.custom_face_image_url,
        uploadedAt: agent.face_consent_at,
      });
    }

    // Use the dedicated Trinity generation status endpoint
    const checkResponse = await fetch(
      `https://api.simli.ai/faces/trinity/generation_status?face_id=${agent.custom_face_id}`,
      {
        method: 'GET',
        headers: { 'x-simli-api-key': SIMLI_API_KEY },
      }
    );

    if (checkResponse.ok) {
      const statusData = await checkResponse.json();
      console.log('[Face Status] Simli response:', JSON.stringify(statusData));

      // Check if generation is complete (status field may be 'completed', 'ready', 'done', or similar)
      const simliStatus = statusData.status || statusData.state || '';
      const isReady = ['completed', 'ready', 'done', 'success'].includes(simliStatus.toLowerCase());

      if (isReady) {
        await updateAgent(id, { custom_face_status: 'ready' });
        return NextResponse.json({
          status: 'ready',
          customFaceId: agent.custom_face_id,
          imageUrl: agent.custom_face_image_url,
          uploadedAt: agent.face_consent_at,
        });
      }

      const isFailed = ['failed', 'error'].includes(simliStatus.toLowerCase());
      if (isFailed) {
        await updateAgent(id, { custom_face_status: 'failed' });
        return NextResponse.json({
          status: 'failed',
          customFaceId: agent.custom_face_id,
          imageUrl: agent.custom_face_image_url,
          uploadedAt: agent.face_consent_at,
        });
      }
    } else {
      // Fallback: check if face exists in the face list (legacy approach)
      const listResponse = await fetch('https://api.simli.ai/faces', {
        method: 'GET',
        headers: { 'x-simli-api-key': SIMLI_API_KEY },
      });

      if (listResponse.ok) {
        const faces = await listResponse.json();
        const faceExists = Array.isArray(faces) && faces.some(
          (f: { id: string }) => f.id === agent.custom_face_id
        );

        if (faceExists) {
          await updateAgent(id, { custom_face_status: 'ready' });
          return NextResponse.json({
            status: 'ready',
            customFaceId: agent.custom_face_id,
            imageUrl: agent.custom_face_image_url,
            uploadedAt: agent.face_consent_at,
          });
        }
      }
    }

    // Check for 10-hour timeout
    if (agent.face_consent_at) {
      const uploadedAt = new Date(agent.face_consent_at).getTime();
      const tenHours = 10 * 60 * 60 * 1000;
      if (Date.now() - uploadedAt > tenHours) {
        // Auto-timeout: mark as failed and try to delete from provider
        console.log('[Face Status] 10-hour timeout reached, marking as failed');
        await updateAgent(id, { custom_face_status: 'failed' });

        // Best-effort delete from provider
        if (SIMLI_API_KEY && agent.custom_face_id) {
          try {
            await fetch(`https://api.simli.ai/faces/trinity/${agent.custom_face_id}`, {
              method: 'DELETE',
              headers: { 'x-simli-api-key': SIMLI_API_KEY },
            });
          } catch { /* best effort */ }
        }

        return NextResponse.json({
          status: 'failed',
          customFaceId: agent.custom_face_id,
          imageUrl: agent.custom_face_image_url,
          uploadedAt: agent.face_consent_at,
        });
      }
    }

    // Still processing
    return NextResponse.json({
      status: 'processing',
      customFaceId: agent.custom_face_id,
      imageUrl: agent.custom_face_image_url,
      uploadedAt: agent.face_consent_at,
    });
  } catch (error) {
    console.error('[Face Status] Error checking Simli:', error);
    return NextResponse.json({
      status: agent.custom_face_status,
      customFaceId: agent.custom_face_id,
      imageUrl: agent.custom_face_image_url,
      uploadedAt: agent.face_consent_at,
    });
  }
}
