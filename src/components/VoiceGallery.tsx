'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Play, Pause, Check, Loader2 } from 'lucide-react';
import { API_ROUTES } from '@/lib/api-routes';

interface GalleryVoice {
  id: string;
  name: string;
  languages: string[];
  tags: string[];
  coverImage: string | null;
  previewUrl: string | null;
  taskCount: number;
}

interface VoiceGalleryProps {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string, voiceName: string) => void;
}

export function VoiceGallery({ selectedVoiceId, onSelect }: VoiceGalleryProps) {
  const [voices, setVoices] = useState<GalleryVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVoices = useCallback(async (pageNum: number, searchQuery: string, append: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        per_page: '20',
      });
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`${API_ROUTES.voiceGallery}?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load voices');
        return;
      }

      const newVoices = data.voices || [];
      setVoices(prev => append ? [...prev, ...newVoices] : newVoices);
      setHasMore(newVoices.length >= 20);
    } catch {
      setError('Failed to load voices');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchVoices(1, '', false);
  }, [fetchVoices]);

  // Search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchVoices(1, search, false);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, fetchVoices]);

  // Cleanup audio
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const playPreview = (voice: GalleryVoice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (!voice.previewUrl) return;

    audioRef.current?.pause();
    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    setPlayingId(voice.id);

    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchVoices(nextPage, search, true);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voices..."
          className="w-full pl-9 pr-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-text-primary text-sm focus:outline-none focus:border-orange-500/50"
        />
      </div>

      {/* Voice grid */}
      {error && (
        <p className="text-sm text-red-400 text-center py-4">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
        {voices.map((voice) => {
          const isSelected = selectedVoiceId === voice.id;
          return (
            <button
              key={voice.id}
              onClick={() => onSelect(voice.id, voice.name)}
              className={`relative p-3 rounded-xl text-left transition-all ${
                isSelected
                  ? 'bg-white/10 border-2 border-orange-500/50'
                  : 'bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#444]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-text-primary truncate flex-1 mr-2">{voice.name}</h4>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              {voice.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {voice.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-[#2A2A2A] rounded text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {voice.previewUrl && (
                <button
                  onClick={(e) => playPreview(voice, e)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    playingId === voice.id
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/10 text-text-secondary hover:bg-white/20'
                  }`}
                >
                  {playingId === voice.id ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading / Load more */}
      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-text-secondary animate-spin" />
        </div>
      )}

      {!loading && hasMore && voices.length > 0 && (
        <button
          onClick={loadMore}
          className="w-full py-2 text-sm text-text-secondary hover:text-text-primary bg-[#1A1A1A] rounded-lg transition-colors"
        >
          Load more voices
        </button>
      )}

      {!loading && voices.length === 0 && !error && (
        <p className="text-sm text-text-muted text-center py-4">No voices found</p>
      )}
    </div>
  );
}
