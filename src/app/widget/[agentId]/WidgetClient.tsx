'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { FACE_THUMBNAILS } from '@/lib/constants';
import Image from 'next/image';

const AvatarInteraction = dynamic(() => import('@/components/AvatarInteraction'), {
  ssr: false,
});

type WidgetState = 'collapsed' | 'expanded' | 'active' | 'ended';

interface WidgetClientProps {
  agentId: string;
  agentName: string;
  greetingMessage: string;
  voiceId: string;
  avatarFaceId: string;
  avatarEnabled: boolean;
  widgetColor: string;
  widgetTitle: string;
  customFaceId?: string | null;
  customFaceStatus?: string;
  customVoiceId?: string | null;
  customVoiceStatus?: string;
  voiceType?: string;
}

export default function WidgetClient({
  agentId,
  agentName,
  greetingMessage,
  voiceId,
  avatarFaceId,
  avatarEnabled,
  widgetColor,
  widgetTitle,
  customFaceId,
  customFaceStatus,
  customVoiceId,
  customVoiceStatus,
  voiceType,
}: WidgetClientProps) {
  const face = FACE_THUMBNAILS[avatarFaceId];
  const [state, setState] = useState<WidgetState>('expanded');
  const [rating, setRating] = useState<'up' | 'down' | null>(null);

  const effectiveVoiceId = (() => {
    if (voiceType === 'cloned' && customVoiceStatus === 'ready' && customVoiceId) {
      return customVoiceId;
    }
    return voiceId;
  })();

  const handleClose = useCallback(() => {
    if (window.parent !== window) {
      const referrer = document.referrer;
      if (!referrer) return;
      try {
        const parentOrigin = new URL(referrer).origin;
        window.parent.postMessage({ type: 'tts-widget-close' }, parentOrigin);
      } catch {
        // Malformed referrer
      }
    }
  }, []);

  const handleStop = useCallback(() => {
    setState('ended');
  }, []);

  const handleRestart = useCallback(() => {
    setState('expanded');
    setRating(null);
  }, []);

  // ─── Collapsed state (floating button) ───
  if (state === 'collapsed') {
    return (
      <div className="flex h-screen w-full items-end justify-end p-4">
        <button
          onClick={() => setState('expanded')}
          className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: widgetColor }}
          aria-label="Open chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-screen max-h-[520px] max-w-[370px] flex-col bg-bg-base font-sans text-text-primary">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{ backgroundColor: widgetColor }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            {face ? (
              <Image
                src={face.src}
                alt={agentName}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight text-white">{widgetTitle}</p>
            <p className="text-[10px] leading-tight text-white/70">
              {state === 'active' ? 'Speaking...' : 'Online'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {state !== 'ended' && (
            <button
              onClick={() => setState('collapsed')}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
              title="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
        {/* ─── Expanded state (pre-start) ─── */}
        {state === 'expanded' && (
          <div className="flex flex-col items-center justify-center gap-4 p-6">
            <div className="h-28 w-28 overflow-hidden rounded-full bg-bg-surface ring-2 ring-white/10">
              {face ? (
                <Image
                  src={face.src}
                  alt={face.name}
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={widgetColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  </svg>
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-white">{agentName}</p>
              <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-text-secondary">
                {greetingMessage || `Hi! I'm ${agentName}. Click start to talk.`}
              </p>
            </div>

            <button
              onClick={() => setState('active')}
              className="mt-2 rounded-full px-8 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-95"
              style={{ backgroundColor: widgetColor }}
            >
              Start Conversation
            </button>
          </div>
        )}

        {/* ─── Active state (conversation) ─── */}
        {state === 'active' && (
          <div className="h-full w-full">
            <AvatarInteraction
              agentId={agentId}
              simli_faceid={avatarFaceId}
              voiceId={effectiveVoiceId}
              facePreviewUrl={face?.src}
              agentName={agentName}
              avatarEnabled={avatarEnabled}
              initialPrompt={greetingMessage}
              onStop={handleStop}
            />
          </div>
        )}

        {/* ─── Ended state ─── */}
        {state === 'ended' && (
          <div className="flex flex-col items-center justify-center gap-5 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={widgetColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <div>
              <p className="text-sm font-medium text-white">Conversation ended</p>
              <p className="mt-1 text-xs text-text-secondary">
                Was this helpful?
              </p>
            </div>

            {/* CSAT rating */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRating('up')}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                  rating === 'up'
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : 'border-white/10 text-text-muted hover:border-white/20 hover:text-white'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </button>
              <button
                onClick={() => setRating('down')}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                  rating === 'down'
                    ? 'border-red-500 bg-red-500/20 text-red-400'
                    : 'border-white/10 text-text-muted hover:border-white/20 hover:text-white'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
              </button>
            </div>

            <button
              onClick={handleRestart}
              className="rounded-full px-6 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
              style={{ backgroundColor: widgetColor }}
            >
              New Conversation
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/5 px-3 py-1.5 text-center">
        <p className="text-[9px] text-text-muted">
          Powered by Talk to Site
        </p>
      </div>
    </div>
  );
}
