// Widget Page — Standalone page rendered inside the embed iframe
// Loads agent config, renders AvatarInteraction with full voice pipeline
// No auth required — this is the public-facing widget

import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';
import WidgetClient from './WidgetClient';

function WidgetNotReady({ status, agentName }: { status: string; agentName: string }) {
  const config: Record<string, { icon: React.ReactNode; title: string; message: string; showSpinner: boolean }> = {
    pending: {
      icon: <Clock className="h-8 w-8 text-accent" />,
      title: 'Setting up...',
      message: `${agentName} is being configured. This page will refresh automatically.`,
      showSpinner: true,
    },
    crawling: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-accent" />,
      title: 'Learning your website...',
      message: `${agentName} is reading your website content. This usually takes 1-2 minutes.`,
      showSpinner: true,
    },
    processing: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-accent" />,
      title: 'Almost ready...',
      message: `${agentName} is processing knowledge and will be ready shortly.`,
      showSpinner: true,
    },
    error: {
      icon: <AlertTriangle className="h-8 w-8 text-error" />,
      title: 'Something went wrong',
      message: `${agentName} encountered an error. Please check agent settings in the dashboard.`,
      showSpinner: false,
    },
  };

  const { icon, title, message, showSpinner } = config[status] || config.pending;

  return (
    <html lang="en">
      <head>
        {/* Auto-refresh every 10s so the page loads when agent becomes ready */}
        {showSpinner && <meta httpEquiv="refresh" content="10" />}
      </head>
      <body style={{ margin: 0, backgroundColor: '#0a0a0f', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          gap: '1rem',
        }}>
          {icon}
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '280px', margin: 0, lineHeight: 1.5 }}>
            {message}
          </p>
          {showSpinner && (
            <div style={{
              marginTop: '0.5rem',
              width: '2rem',
              height: '2rem',
              border: '3px solid rgba(59,130,246,0.2)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </body>
    </html>
  );
}

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  const supabase = createAdminClient();

  // First try with all columns (including custom face/voice from migration 005)
  let { data: agent, error } = await supabase
    .from('agents')
    .select(
      'id, name, status, greeting_message, voice_id, avatar_face_id, avatar_enabled, widget_color, widget_position, widget_title, custom_face_id, custom_face_status, custom_voice_id, custom_voice_status, voice_type'
    )
    .eq('id', agentId)
    .single();

  // If custom columns don't exist yet (migration 005 not applied), fall back to base columns
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

  // Agent not found in DB → 404
  if (error || !agent) {
    notFound();
  }

  // Agent exists but not ready → show status page instead of 404
  if (agent.status !== 'ready') {
    return <WidgetNotReady status={agent.status} agentName={agent.name} />;
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
      customFaceId={agent.custom_face_id}
      customFaceStatus={agent.custom_face_status}
      customVoiceId={agent.custom_voice_id}
      customVoiceStatus={agent.custom_voice_status}
      voiceType={agent.voice_type}
    />
  );
}
