'use client';

import type { Agent } from '@/lib/types';
import { FaceGallery } from '@/components/FaceGallery';
import { VoiceSelector } from '@/components/VoiceSelector';

interface VoiceAvatarTabProps {
  agent: Agent;
  onChange: (field: keyof Agent, value: string | boolean | number) => void;
}

export function VoiceAvatarTab({ agent, onChange }: VoiceAvatarTabProps) {
  return (
    <div className="space-y-10">
      {/* Avatar section */}
      <div>
        <h3 className="mb-2 text-base font-semibold text-text-primary">Avatar Face</h3>
        <p className="mb-4 text-sm text-text-secondary">
          Choose the face your AI agent will use when speaking to visitors.
        </p>
        <FaceGallery
          selectedFaceId={agent.avatar_face_id}
          onSelect={(faceId: string) => onChange('avatar_face_id', faceId)}
        />
      </div>

      {/* Avatar toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-bg-surface px-5 py-4">
        <div>
          <p className="text-sm font-medium text-text-primary">Enable Talking Avatar</p>
          <p className="text-xs text-text-muted">Show a lip-synced face during conversations</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={agent.avatar_enabled}
          onClick={() => onChange('avatar_enabled', !agent.avatar_enabled)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            agent.avatar_enabled ? 'bg-accent' : 'bg-bg-elevated'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              agent.avatar_enabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {/* Voice section */}
      <div>
        <h3 className="mb-2 text-base font-semibold text-text-primary">Voice</h3>
        <p className="mb-4 text-sm text-text-secondary">
          Select the voice your agent will use for spoken responses.
        </p>
        <VoiceSelector
          selectedVoice={agent.voice_id}
          onSelect={(voiceId: string) => onChange('voice_id', voiceId)}
          agentId={agent.id}
          voiceType={agent.voice_type}
        />
      </div>
    </div>
  );
}
