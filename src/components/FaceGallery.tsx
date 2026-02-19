'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { FACE_THUMBNAILS } from '@/lib/constants';

interface FaceGalleryProps {
  selectedFaceId: string;
  onSelect: (faceId: string) => void;
}

const faces = Object.entries(FACE_THUMBNAILS).map(([id, data]) => ({ id, ...data }));

export function FaceGallery({ selectedFaceId, onSelect }: FaceGalleryProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {faces.map((face) => {
        const isSelected = face.id === selectedFaceId;
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
              <p className="text-sm font-medium text-white">{face.name}</p>
              <p className="text-xs text-[#6B7280]">{face.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
