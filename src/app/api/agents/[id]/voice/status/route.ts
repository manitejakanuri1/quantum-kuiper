// Voice Clone Status API
// GET /api/agents/[id]/voice/status — Check Fish Audio voice clone processing status

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAgent, updateAgent } from '@/lib/db';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;

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

  // If not processing, return current status
  if (agent.custom_voice_status !== 'processing' || !agent.custom_voice_id) {
    return NextResponse.json({
      status: agent.custom_voice_status,
      customVoiceId: agent.custom_voice_id,
      voiceName: agent.custom_voice_name,
    });
  }

  // Check Fish Audio model status
  try {
    if (!FISH_AUDIO_API_KEY) {
      return NextResponse.json({
        status: agent.custom_voice_status,
        customVoiceId: agent.custom_voice_id,
        voiceName: agent.custom_voice_name,
      });
    }

    const checkResponse = await fetch(`https://api.fish.audio/model/${agent.custom_voice_id}`, {
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
      },
    });

    if (checkResponse.ok) {
      const modelData = await checkResponse.json();
      const modelStatus = modelData.state || modelData.status;

      if (modelStatus === 'trained' || modelStatus === 'ready' || modelStatus === 'completed') {
        await updateAgent(id, { custom_voice_status: 'ready' });
        return NextResponse.json({
          status: 'ready',
          customVoiceId: agent.custom_voice_id,
          voiceName: agent.custom_voice_name,
        });
      }

      if (modelStatus === 'failed' || modelStatus === 'error') {
        await updateAgent(id, { custom_voice_status: 'failed' });
        return NextResponse.json({
          status: 'failed',
          customVoiceId: agent.custom_voice_id,
          voiceName: agent.custom_voice_name,
        });
      }
    }

    // Still processing or unable to determine
    return NextResponse.json({
      status: 'processing',
      customVoiceId: agent.custom_voice_id,
      voiceName: agent.custom_voice_name,
    });
  } catch (error) {
    console.error('[Voice Status] Error:', error);
    return NextResponse.json({
      status: agent.custom_voice_status,
      customVoiceId: agent.custom_voice_id,
      voiceName: agent.custom_voice_name,
    });
  }
}
