'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { FACE_THUMBNAILS } from '@/lib/constants';
import Image from 'next/image';

// Dynamic import — Simli uses WebRTC which requires browser APIs
const AvatarInteraction = dynamic(() => import('@/components/AvatarInteraction'), {
  ssr: false,
});

interface WidgetClientProps {
  agentId: string;
  agentName: string;
  greetingMessage: string;
  voiceId: string;
  avatarFaceId: string;
  avatarEnabled: boolean;
  widgetColor: string;
  widgetTitle: string;
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
}: WidgetClientProps) {
  const face = FACE_THUMBNAILS[avatarFaceId];
  const [started, setStarted] = useState(false);

  const handleClose = () => {
    if (window.parent !== window) {
      // Derive parent origin from referrer (set when iframe loads)
      // Falls back to '*' only if referrer is empty (same-origin or direct access)
      const parentOrigin = document.referrer
        ? new URL(document.referrer).origin
        : '*';
      window.parent.postMessage({ type: 'tts-widget-close' }, parentOrigin);
    }
  };

  return (
    <div className="flex flex-col text-white h-screen max-h-[520px] max-w-[370px] mx-auto bg-[#0D0D0D] font-sans">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ backgroundColor: widgetColor }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-white leading-tight">{widgetTitle}</p>
            <p className="text-[10px] text-white/70 leading-tight">Online</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden relative">
        {started ? (
          <div className="w-full h-full">
            <AvatarInteraction
              agentId={agentId}
              simli_faceid={avatarFaceId}
              voiceId={voiceId}
              facePreviewUrl={face?.src}
              agentName={agentName}
              avatarEnabled={avatarEnabled}
              initialPrompt={greetingMessage}
              onStop={() => setStarted(false)}
            />
          </div>
        ) : (
          /* Pre-start state: avatar preview + start button */
          <div className="flex flex-col items-center justify-center gap-4 p-6">
            {/* Small avatar preview */}
            <div className="w-28 h-28 rounded-full overflow-hidden ring-2 ring-white/10 bg-[#111]">
              {face ? (
                <Image
                  src={face.src}
                  alt={face.name}
                  width={112}
                  height={112}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900/20 to-[#111]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
                  </svg>
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-white">{agentName}</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[240px] leading-relaxed">
                {greetingMessage || `Hi! I'm ${agentName}. Click start to talk.`}
              </p>
            </div>

            <button
              onClick={() => setStarted(true)}
              className="mt-2 rounded-full px-8 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-95"
              style={{ backgroundColor: widgetColor }}
            >
              Start Conversation
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 text-center border-t border-white/5 shrink-0">
        <p className="text-[9px] text-gray-600">
          Powered by Talk to Site
        </p>
      </div>
    </div>
  );
}
