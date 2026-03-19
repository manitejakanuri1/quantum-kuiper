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
    });
  }

  // Poll Simli API to check if face is ready
  try {
    if (!SIMLI_API_KEY) {
      return NextResponse.json({
        status: agent.custom_face_status,
        customFaceId: agent.custom_face_id,
        imageUrl: agent.custom_face_image_url,
      });
    }

    // Check if face exists in the user's face list (means it's ready)
    const checkResponse = await fetch('https://api.simli.ai/faces', {
      method: 'GET',
      headers: { 'x-simli-api-key': SIMLI_API_KEY },
    });

    if (checkResponse.ok) {
      const faces = await checkResponse.json();
      const faceExists = Array.isArray(faces) && faces.some(
        (f: { id: string }) => f.id === agent.custom_face_id
      );

      if (faceExists) {
        // Face is ready — update status
        await updateAgent(id, { custom_face_status: 'ready' });
        return NextResponse.json({
          status: 'ready',
          customFaceId: agent.custom_face_id,
          imageUrl: agent.custom_face_image_url,
        });
      }
    }

    // Still processing
    return NextResponse.json({
      status: 'processing',
      customFaceId: agent.custom_face_id,
      imageUrl: agent.custom_face_image_url,
    });
  } catch (error) {
    console.error('[Face Status] Error checking Simli:', error);
    return NextResponse.json({
      status: agent.custom_face_status,
      customFaceId: agent.custom_face_id,
      imageUrl: agent.custom_face_image_url,
    });
  }
}
