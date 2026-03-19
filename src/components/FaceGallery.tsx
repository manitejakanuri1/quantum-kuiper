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
  const hasCustomFace = customFaceStatus !== 'none' && customFaceImageUrl;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Custom face card */}
      <button
        type="button"
        onClick={() => {
          if (customFaceStatus === 'ready' && customFaceId) {
            onSelect(customFaceId);
          } else if (customFaceStatus === 'none' || customFaceStatus === 'failed') {
            onUploadClick?.();
          }
        }}
        className={`group relative rounded-xl overflow-hidden transition-all ${
          isCustomSelected
            ? 'ring-2 ring-orange-500'
            : 'ring-1 ring-[#1F1F1F] hover:ring-orange-500/30'
        }`}
      >
        <div className="relative aspect-[3/4]">
          {hasCustomFace ? (
            <>
              <Image
                src={customFaceImageUrl}
                alt="Custom face"
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="200px"
                unoptimized
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

              {/* Processing overlay */}
              {customFaceStatus === 'processing' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 text-orange-500 animate-spin mx-auto" />
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
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
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
      </button>

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
                ? 'ring-2 ring-orange-500'
                : 'ring-1 ring-[#1F1F1F] hover:ring-orange-500/30'
            }`}
          >
            <div className="relative aspect-[3/4]">
              <Image
                src={face.src}
                alt={face.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="200px"
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
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
