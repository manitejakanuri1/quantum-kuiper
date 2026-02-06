'use client';

import { useState } from 'react';
import { AVAILABLE_FACES } from '@/lib/simile';
import { Check, User } from 'lucide-react';
import Image from 'next/image';

interface FaceGalleryProps {
    selectedFace: string | null;
    onSelect: (faceId: string) => void;
}

// Check if thumbnail exists (starts with /faces/ and has valid extension)
function hasRealThumbnail(thumbnail: string): boolean {
    return thumbnail.startsWith('/faces/') &&
        (thumbnail.endsWith('.png') || thumbnail.endsWith('.jpg') || thumbnail.endsWith('.jpeg'));
}

export function FaceGallery({ selectedFace, onSelect }: FaceGalleryProps) {
    const [hoveredFace, setHoveredFace] = useState<string | null>(null);
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

    const handleImageError = (faceId: string) => {
        setImageErrors(prev => new Set(prev).add(faceId));
    };

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {AVAILABLE_FACES.map((face) => {
                const isSelected = selectedFace === face.id;
                const isHovered = hoveredFace === face.id;
                const showRealImage = hasRealThumbnail(face.thumbnail) && !imageErrors.has(face.id);

                return (
                    <button
                        key={face.id}
                        onClick={() => onSelect(face.id)}
                        onMouseEnter={() => setHoveredFace(face.id)}
                        onMouseLeave={() => setHoveredFace(null)}
                        className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all duration-300 ${isSelected
                            ? 'ring-4 ring-white shadow-lg shadow-white/25 scale-[1.02]'
                            : 'ring-1 ring-white/20 hover:ring-white/40'
                            }`}
                    >
                        {/* Background with real image or placeholder */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900">
                            {showRealImage ? (
                                <Image
                                    src={face.thumbnail}
                                    alt={face.name}
                                    fill
                                    className={`object-cover transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'
                                        }`}
                                    onError={() => handleImageError(face.id)}
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className={`w-24 h-24 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 ${isHovered ? 'scale-110' : 'scale-100'
                                        }`}>
                                        <User className="w-12 h-12 text-white/60" />
                                    </div>
                                </div>
                            )}
                        </div>



                        {/* Selected indicator */}
                        {isSelected && (
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                                <Check className="w-4 h-4 text-black" />
                            </div>
                        )}

                        {/* Name overlay */}
                        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                            <h3 className="text-white font-medium">{face.name}</h3>
                            <p className="text-xs text-gray-400 capitalize">{face.gender}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
