'use client';

import Image from 'next/image';
import { Check, Camera, Loader2, Trash2 } from 'lucide-react';
import { FACE_THUMBNAILS } from '@/lib/constants';
import type { CustomAssetStatus } from '@/lib/types';

interface FaceGalleryProps {
  selectedFaceId: string;
  onSelect: (faceId: string) => void;
  customFaceId?: string | null;
  customFaceStatus?: CustomAssetStatus;
  customFaceImageUrl?: string | null;
  onUploadClick?: () => void;
  onRemoveCustomFace?: () => void;
}

const faces = Object.entries(FACE_THUMBNAILS).map(([id, data]) => ({ id, ...data }));

export function FaceGallery({
  selectedFaceId,
  onSelect,
  customFaceId,
  customFaceStatus = 'none',
  customFaceImageUrl,
  onUploadClick,
  onRemoveCustomFace,
}: FaceGalleryProps) {
  const isCustomSelected = customFaceId && selectedFaceId === customFaceId;
  const hasCustomFace = customFaceStatus !== 'none';

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Custom face card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (customFaceStatus === 'ready' && customFaceId) {
            // Select the custom face (whether or not we have a preview image)
            onSelect(customFaceId);
          } else if (customFaceStatus === 'none' || customFaceStatus === 'failed') {
            onUploadClick?.();
          }
        }}
        className={`group relative cursor-pointer rounded-xl overflow-hidden transition-all ${
          isCustomSelected
            ? 'ring-2 ring-accent'
            : 'ring-1 ring-[#1F1F1F] hover:ring-accent/30'
        }`}
      >
        <div className="relative aspect-[3/4]">
          {hasCustomFace ? (
            <>
              {customFaceImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={customFaceImageUrl.startsWith('http') ? customFaceImageUrl : `/api/agents/${customFaceImageUrl.split('/')[0]}/face/image`}
                  alt="Custom face"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center mb-2">
                      <Check className="w-7 h-7 text-accent" />
                    </div>
                    <p className="text-xs text-text-secondary">Face ready</p>
                    <p className="text-[10px] text-text-muted mt-1">Click to add preview</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

              {/* Processing overlay */}
              {customFaceStatus === 'processing' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto" />
                    <p className="text-xs text-text-primary mt-2">Processing...</p>
                  </div>
                </div>
              )}

              {/* Failed overlay */}
              {customFaceStatus === 'failed' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <p className="text-xs text-red-400 text-center px-2">Failed — click to retry</p>
                </div>
              )}

              {/* Selected checkmark */}
              {isCustomSelected && (
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              {/* Remove button */}
              {onRemoveCustomFace && (customFaceStatus === 'ready' || customFaceStatus === 'failed') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomFace();
                  }}
                  className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove custom face"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#2A2A2A] flex items-center justify-center mb-2">
                  <Camera className="w-5 h-5 text-text-secondary" />
                </div>
                <p className="text-xs text-text-secondary">Upload your face</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-3 bg-[#141414]">
          <p className="text-sm font-medium text-text-primary">Custom Face</p>
          <p className="text-xs text-[#6B7280]">
            {customFaceStatus === 'ready' ? 'Ready' :
             customFaceStatus === 'processing' ? 'Processing...' :
             customFaceStatus === 'failed' ? 'Failed' :
             'Upload photo'}
          </p>
        </div>
      </div>

      {/* Preset faces */}
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
  );
}
