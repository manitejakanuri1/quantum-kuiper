'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Check, Camera, Loader2, Trash2, Upload, Clock } from 'lucide-react';
import { FACE_THUMBNAILS } from '@/lib/constants';
import type { CustomAssetStatus } from '@/lib/types';

interface FaceGalleryProps {
  selectedFaceId: string;
  onSelect: (faceId: string) => void;
  agentId: string;
  customFaceId?: string | null;
  customFaceStatus?: CustomAssetStatus;
  customFaceImageUrl?: string | null;
  customFaceUploadedAt?: string | null;
  onUploadClick?: () => void;
  onRemoveCustomFace?: () => void;
}

function useCountdown(uploadedAt: string | null | undefined, isProcessing: boolean) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!isProcessing || !uploadedAt) {
      setTimeRemaining('');
      return;
    }

    const update = () => {
      const uploaded = new Date(uploadedAt).getTime();
      const estimatedEnd = uploaded + 8 * 60 * 60 * 1000;
      const remaining = estimatedEnd - Date.now();

      if (remaining <= 0) {
        setTimeRemaining('Should be ready soon...');
        return;
      }

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      setTimeRemaining(hours > 0 ? `~${hours}h ${minutes}m remaining` : `~${minutes}m remaining`);
    };

    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [uploadedAt, isProcessing]);

  return timeRemaining;
}

const faces = Object.entries(FACE_THUMBNAILS).map(([id, data]) => ({ id, ...data }));

export function FaceGallery({
  selectedFaceId,
  onSelect,
  agentId,
  customFaceId,
  customFaceStatus = 'none',
  customFaceImageUrl,
  customFaceUploadedAt,
  onUploadClick,
  onRemoveCustomFace,
}: FaceGalleryProps) {
  const [cancelling, setCancelling] = useState(false);
  const isCustomSelected = customFaceId && selectedFaceId === customFaceId;
  const hasCustomFace = customFaceStatus !== 'none';
  const isCustomReady = customFaceStatus === 'ready' && customFaceId;
  const timeRemaining = useCountdown(customFaceUploadedAt, customFaceStatus === 'processing');

  const handleCancelAndRetry = async () => {
    setCancelling(true);
    try {
      await fetch(`/api/agents/${agentId}/face`, { method: 'DELETE' });
      onRemoveCustomFace?.();
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Custom face section — at the top */}
      <div className="pb-4 border-b border-border-default">
        <p className="text-xs font-medium text-text-secondary mb-3">Custom Avatar</p>

        {!hasCustomFace && (
          <button
            type="button"
            onClick={() => onUploadClick?.()}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-border-default hover:border-accent/50 transition-colors bg-bg-surface/50"
          >
            <div className="w-12 h-12 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-text-primary">Upload your face</p>
              <p className="text-xs text-text-muted">Create a custom AI avatar from your photo</p>
            </div>
          </button>
        )}

        {hasCustomFace && (
          <div
            role={isCustomReady ? 'button' : undefined}
            tabIndex={isCustomReady ? 0 : undefined}
            onClick={() => {
              if (isCustomReady) onSelect(customFaceId!);
            }}
            className={`relative flex items-center gap-4 p-4 rounded-xl transition-all ${
              isCustomReady ? 'cursor-pointer' : ''
            } ${
              isCustomSelected
                ? 'ring-2 ring-accent bg-accent/5'
                : 'ring-1 ring-[#1F1F1F] hover:ring-accent/30'
            }`}
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#1A1A1A]">
              {customFaceImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={customFaceImageUrl.startsWith('http') ? customFaceImageUrl : undefined}
                  alt="Custom face"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {customFaceStatus === 'processing' ? (
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  ) : customFaceStatus === 'ready' ? (
                    <Check className="w-5 h-5 text-accent" />
                  ) : (
                    <Camera className="w-5 h-5 text-text-muted" />
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">Custom Face</p>
              <p className="text-xs text-text-muted">
                {customFaceStatus === 'ready' && 'Ready — click to use'}
                {customFaceStatus === 'processing' && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-accent" />
                    {timeRemaining || 'Processing... this can take up to 8 hours'}
                  </span>
                )}
                {customFaceStatus === 'failed' && 'Generation failed. Try a different photo.'}
                {customFaceStatus === 'uploading' && 'Uploading...'}
              </p>
            </div>

            {isCustomSelected && (
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            <div className="flex gap-1 shrink-0">
              {customFaceStatus === 'processing' && (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={(e) => { e.stopPropagation(); handleCancelAndRetry(); }}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel & Retry'}
                </button>
              )}
              {customFaceStatus === 'failed' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleCancelAndRetry().then(() => onUploadClick?.()); }}
                  className="px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors"
                >
                  Try Again
                </button>
              )}
              {onRemoveCustomFace && (customFaceStatus === 'ready' || customFaceStatus === 'failed') && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveCustomFace(); }}
                  className="p-1.5 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                  title="Remove custom face"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preset faces grid */}
      <div>
        <p className="text-xs font-medium text-text-secondary mb-3">Preset Avatars</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {faces.map((face) => {
          const isSelected = face.id === selectedFaceId && !isCustomSelected;
          return (
            <button
              key={face.id}
              type="button"
              onClick={() => onSelect(face.id)}
              className={`group relative rounded-xl overflow-hidden transition-all ${
                isSelected
                  ? 'ring-2 ring-accent'
                  : 'ring-1 ring-[#1F1F1F] hover:ring-accent/30'
              }`}
            >
              <div className="relative aspect-[3/4]">
                <Image
                  src={face.src}
                  alt={face.name}
                  fill
                  quality={95}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="256px"
                />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
              <div className="p-3 bg-[#141414]">
                <p className="text-sm font-medium text-text-primary">{face.name}</p>
                <p className="text-xs text-[#6B7280]">{face.label}</p>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
