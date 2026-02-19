import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAgent } from '@/lib/db';
import { z } from 'zod';
import { isPublicUrl } from '@/lib/url-validation';
import { requireJsonContentType } from '@/lib/request-validation';

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  website_url: z.string().url().max(2000).refine(isPublicUrl, {
    message: 'URL must point to a public website (private/internal addresses are not allowed)',
  }),
  greeting_message: z.string().max(500).optional(),
  system_prompt: z.string().max(10000).optional(),
  voice_id: z.string().max(64).optional(),
  avatar_face_id: z.string().max(64).optional(),
  widget_color: z.string().max(7).regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  widget_position: z.enum(['bottom-right', 'bottom-left']).optional(),
  widget_title: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentTypeError = requireJsonContentType(request);
  if (contentTypeError) return contentTypeError;

  const body = await request.json();
  const parsed = createAgentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agent = await createAgent({
    user_id: user.id,
    ...parsed.data,
  });

  if (!agent) {
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }

  return NextResponse.json({ agent }, { status: 201 });
}
