// Widget Page — Standalone page rendered inside the embed iframe
// Loads agent config, renders AvatarInteraction with full voice pipeline
// No auth required — this is the public-facing widget

import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import WidgetClient from './WidgetClient';

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  const supabase = createAdminClient();
  const { data: agent, error } = await supabase
    .from('agents')
    .select(
      'id, name, status, greeting_message, voice_id, avatar_face_id, avatar_enabled, widget_color, widget_position, widget_title'
    )
    .eq('id', agentId)
    .single();

  if (error || !agent || agent.status !== 'ready') {
    notFound();
  }

  // Validate hex color to prevent CSS injection (defense-in-depth)
  const rawColor = agent.widget_color || '#F97316';
  const widgetColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : '#F97316';

  return (
    <WidgetClient
      agentId={agent.id}
      agentName={agent.name}
      greetingMessage={agent.greeting_message}
      voiceId={agent.voice_id}
      avatarFaceId={agent.avatar_face_id}
      avatarEnabled={agent.avatar_enabled}
      widgetColor={widgetColor}
      widgetTitle={agent.widget_title || agent.name}
    />
  );
}
