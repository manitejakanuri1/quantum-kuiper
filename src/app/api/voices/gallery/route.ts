// Voice Gallery API
// GET /api/voices/gallery — Browse Fish Audio community voices

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;

// Simple in-memory cache for gallery results
const galleryCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  // Rate limit: 30 requests per minute
  const rateLimitResult = await rateLimit(
    `voice-gallery:${getClientIdentifier(request)}`,
    { max: 30, windowMs: 60_000 }
  );
  if (rateLimitResult) return rateLimitResult;

  // Auth required
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!FISH_AUDIO_API_KEY) {
    return NextResponse.json({ error: 'Fish Audio API key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '20', 10), 50);
  const search = searchParams.get('search') || '';
  const language = searchParams.get('language') || '';
  const gender = searchParams.get('gender') || '';

  // Check cache
  const cacheKey = `${page}:${perPage}:${search}:${language}:${gender}`;
  const cached = galleryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Build Fish Audio API query
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      sort: 'task_count',
    });

    if (search) queryParams.set('title', search);
    if (language) queryParams.set('language', language);
    if (gender) queryParams.set('gender', gender);

    const fishResponse = await fetch(
      `https://api.fish.audio/model?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
        },
      }
    );

    if (!fishResponse.ok) {
      const errorText = await fishResponse.text();
      console.error('[Voice Gallery] Fish Audio API error:', fishResponse.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 502 });
    }

    const fishData = await fishResponse.json();

    // Transform to our Voice shape
    const voices = (fishData.items || fishData || []).map((model: {
      _id?: string;
      id?: string;
      title?: string;
      name?: string;
      languages?: string[];
      tags?: string[];
      cover_image?: string;
      samples?: { url: string }[];
      task_count?: number;
    }) => ({
      id: model._id || model.id,
      name: model.title || model.name || 'Untitled',
      languages: model.languages || [],
      tags: model.tags || [],
      coverImage: model.cover_image || null,
      previewUrl: model.samples?.[0]?.url || null,
      taskCount: model.task_count || 0,
    }));

    const result = {
      voices,
      total: fishData.total || voices.length,
      page,
      perPage,
    };

    // Cache the result
    galleryCache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Prune old cache entries
    if (galleryCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of galleryCache) {
        if (now - value.timestamp > CACHE_TTL) galleryCache.delete(key);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Voice Gallery] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
