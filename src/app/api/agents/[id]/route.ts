import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAgent, updateAgent, deleteAgent } from '@/lib/db';
import { z } from 'zod';
import type { ExtractedInfo } from '@/lib/types';
import { isPublicUrl } from '@/lib/url-validation';
import { requireJsonContentType } from '@/lib/request-validation';

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  website_url: z.string().url().max(2000).refine(isPublicUrl, {
    message: 'URL must point to a public website (private/internal addresses are not allowed)',
  }).optional(),
  greeting_message: z.string().max(500).optional(),
  system_prompt: z.string().max(10000).optional(),
  voice_id: z.string().max(64).optional(),
  avatar_face_id: z.string().max(64).optional(),
  avatar_enabled: z.boolean().optional(),
  avatar_duration_limit: z.number().min(0).max(3600).optional(),
  widget_color: z.string().max(7).regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  widget_position: z.enum(['bottom-right', 'bottom-left']).optional(),
  widget_title: z.string().max(100).optional(),
  prompt_customized: z.boolean().optional(),
  extracted_info: z.custom<ExtractedInfo>((val) => typeof val === 'object' && val !== null).optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function authenticateAndGetAgent(agentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized', status: 401 };

  const agent = await getAgent(agentId);
  if (!agent) return { error: 'Agent not found', status: 404 };
  if (agent.user_id !== user.id) return { error: 'Forbidden', status: 403 };

  return { user, agent };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await authenticateAndGetAgent(id);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ agent: result.agent });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await authenticateAndGetAgent(id);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const contentTypeError = requireJsonContentType(request);
  if (contentTypeError) return contentTypeError;

  const body = await request.json();
  const parsed = updateAgentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateAgent(id, parsed.data);

  if (!updated) {
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }

  return NextResponse.json({ agent: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await authenticateAndGetAgent(id);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const deleted = await deleteAgent(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
