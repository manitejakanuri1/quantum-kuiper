// Public Widget Config API — No auth required
// GET /api/widget/[agentId]
// Returns agent configuration needed to render the widget on any website

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  // Rate limit: 60 requests per minute per IP
  const rateLimitResult = await rateLimit(
    `widget:${getClientIdentifier(request)}`,
    { max: 60, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  const { agentId } = await params;

  const supabase = createAdminClient();

  // Try with all columns first; fall back to base columns if migration 005 not applied
  let { data: agent, error } = await supabase
    .from('agents')
    .select(
      'id, name, status, greeting_message, voice_id, avatar_face_id, avatar_enabled, widget_color, widget_position, widget_title, custom_face_id, custom_face_status, custom_voice_id, custom_voice_status, voice_type'
    )
    .eq('id', agentId)
    .single();

  if (error?.message?.includes('does not exist')) {
    const fallback = await supabase
      .from('agents')
      .select(
        'id, name, status, greeting_message, voice_id, avatar_face_id, avatar_enabled, widget_color, widget_position, widget_title'
      )
      .eq('id', agentId)
      .single();
    agent = fallback.data as typeof agent;
    error = fallback.error;
  }

  if (error || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  if (agent.status !== 'ready') {
    return NextResponse.json(
      { error: 'Agent is not available' },
      { status: 400 }
    );
  }

  // Validate widget_color is a safe hex color (prevent CSS injection)
  const rawColor = agent.widget_color || '#F97316';
  const widgetColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : '#F97316';

  // Return only what the widget needs — no secrets
  return NextResponse.json(
    {
      id: agent.id,
      name: agent.name,
      greeting_message: agent.greeting_message,
      voice_id: agent.voice_id,
      avatar_face_id: agent.avatar_face_id,
      avatar_enabled: agent.avatar_enabled,
      widget_color: widgetColor,
      widget_position: agent.widget_position || 'bottom-right',
      widget_title: agent.widget_title || agent.name,
      custom_face_id: agent.custom_face_id || null,
      custom_face_status: agent.custom_face_status || 'none',
      custom_voice_id: agent.custom_voice_id || null,
      custom_voice_status: agent.custom_voice_status || 'none',
      voice_type: agent.voice_type || 'default',
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'private, max-age=60',
      },
    }
  );
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
