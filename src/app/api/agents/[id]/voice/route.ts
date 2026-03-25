// Custom Voice Clone API
// POST /api/agents/[id]/voice — Upload audio to create Fish Audio voice clone
// DELETE /api/agents/[id]/voice — Remove custom voice, revert to preset

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAgent, updateAgent } from '@/lib/db';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;

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
    if (!FISH_AUDIO_API_KEY) {
      return NextResponse.json({ error: 'Fish Audio API key not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('audio') as File | null;
    const consent = formData.get('consent');
    const voiceName = formData.get('voiceName') as string | null;

    if (consent !== 'true') {
      return NextResponse.json({ error: 'Consent is required' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    if (!voiceName || voiceName.trim().length === 0) {
      return NextResponse.json({ error: 'Voice name is required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only WAV, MP3, WebM, and M4A audio files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file must be smaller than 10MB' }, { status: 400 });
    }

    // Set status to uploading
    await updateAgent(id, { custom_voice_status: 'uploading' });

    // Determine file extension
    const extMap: Record<string, string> = {
      'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
      'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a',
    };
    const ext = extMap[file.type] || 'wav';
    const storagePath = `${id}/voice-sample.${ext}`;

    // Upload to Supabase Storage
    const admin = createAdminClient();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Remove old samples
    await admin.storage.from('voice-samples').remove([
      `${id}/voice-sample.wav`, `${id}/voice-sample.mp3`,
      `${id}/voice-sample.webm`, `${id}/voice-sample.m4a`,
    ]);

    const { error: uploadError } = await admin.storage
      .from('voice-samples')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Voice Clone] Storage error:', uploadError);
      await updateAgent(id, { custom_voice_status: 'failed' });
      return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from('voice-samples').getPublicUrl(storagePath);

    // Call Fish Audio API to create voice clone
    const fishFormData = new FormData();
    fishFormData.append('title', voiceName.trim());
    fishFormData.append('type', 'tts');
    fishFormData.append('train_mode', 'fast');
    fishFormData.append('visibility', 'private');
    fishFormData.append('voices', new Blob([fileBuffer], { type: file.type }), `sample.${ext}`);

    console.log(`[Voice Clone] Creating voice clone "${voiceName}" for agent ${id}`);

    const fishResponse = await fetch('https://api.fish.audio/model', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
      },
      body: fishFormData,
    });

    if (!fishResponse.ok) {
      const errorText = await fishResponse.text();
      console.error('[Voice Clone] Fish Audio API error:', fishResponse.status, errorText);
      await updateAgent(id, { custom_voice_status: 'failed' });

      let userError = 'Failed to create voice clone. Please try again.';
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.detail) userError = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        else if (parsed.message) userError = parsed.message;
        else if (parsed.error) userError = parsed.error;
      } catch { /* use default */ }

      return NextResponse.json({ error: userError }, { status: 502 });
    }

    const fishRawText = await fishResponse.text();
    console.log('[Voice Clone] Fish Audio raw response:', fishRawText);

    let fishData;
    try {
      fishData = JSON.parse(fishRawText);
    } catch {
      console.error('[Voice Clone] Failed to parse Fish Audio response as JSON');
      await updateAgent(id, { custom_voice_status: 'failed' });
      return NextResponse.json({ error: 'Unexpected response from voice service' }, { status: 502 });
    }

    const modelId = fishData._id || fishData.id || fishData.model_id;

    if (!modelId) {
      console.error('[Voice Clone] No model ID in response:', JSON.stringify(fishData));
      await updateAgent(id, { custom_voice_status: 'failed' });
      return NextResponse.json(
        { error: fishData.detail || fishData.message || 'Voice service did not return a model ID. Please try again.' },
        { status: 502 }
      );
    }

    await updateAgent(id, {
      custom_voice_id: modelId,
      custom_voice_status: 'processing',
      custom_voice_name: voiceName.trim(),
      voice_type: 'cloned',
      voice_sample_url: urlData.publicUrl,
      voice_consent_at: new Date().toISOString(),
    });

    console.log(`[Voice Clone] Created model ${modelId} for agent ${id}`);

    return NextResponse.json({
      status: 'processing',
      customVoiceId: modelId,
      voiceName: voiceName.trim(),
    });
  } catch (error) {
    console.error('[Voice Clone] Error:', error);
    await updateAgent(id, { custom_voice_status: 'failed' });
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
    await admin.storage.from('voice-samples').remove([
      `${id}/voice-sample.wav`, `${id}/voice-sample.mp3`,
      `${id}/voice-sample.webm`, `${id}/voice-sample.m4a`,
    ]);

    // Reset custom voice fields
    await updateAgent(id, {
      custom_voice_id: null,
      custom_voice_status: 'none',
      custom_voice_name: null,
      voice_type: 'default',
      voice_sample_url: null,
      voice_consent_at: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Voice Delete] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
