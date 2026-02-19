// POST /api/agents/[id]/regenerate-prompt
// Manually regenerate the system prompt from crawled content.
// Always overwrites the current prompt, even if customized.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAgentPrompt } from '@/lib/rag/prompt-generator';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const admin = createAdminClient();
  const { data: agent, error: agentError } = await admin
    .from('agents')
    .select('user_id, status')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  if (agent.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Agent must have been crawled
  if (agent.status !== 'ready') {
    return NextResponse.json(
      { error: 'Agent must be in ready state (crawl first)' },
      { status: 400 }
    );
  }

  try {
    // Force overwrite = true (user explicitly asked to regenerate)
    const result = await generateAgentPrompt(agentId, true);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to generate prompt. Make sure the agent has crawled pages.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      system_prompt: result.systemPrompt,
      greeting: result.greeting,
      extracted_info: result.extractedInfo,
    });
  } catch (error) {
    console.error('[RegeneratePrompt] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate prompt' },
      { status: 500 }
    );
  }
}
