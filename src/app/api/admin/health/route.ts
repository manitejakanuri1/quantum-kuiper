import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'manitejakanuri1@gmail.com';

async function checkService(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    return { name, status: 'healthy' as const, latency: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { name, status: 'down' as const, latency: Date.now() - start, details: message };
  }
}

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const services = await Promise.all([
    // Supabase DB
    checkService('Supabase Database', async () => {
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (error) throw error;
    }),

    // Supabase Auth
    checkService('Supabase Auth', async () => {
      const { error } = await supabase.auth.getUser();
      if (error) throw error;
    }),

    // Fish Audio TTS
    checkService('Fish Audio TTS', async () => {
      const key = process.env.FISH_AUDIO_API_KEY;
      if (!key) throw new Error('API key not configured');
      const res = await fetch('https://api.fish.audio/model?page_size=1', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // Simli Avatar
    checkService('Simli Avatar', async () => {
      const key = process.env.SIMLI_API_KEY;
      if (!key) throw new Error('API key not configured');
      const res = await fetch('https://api.simli.ai/faces', {
        headers: { 'x-simli-api-key': key },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // Pinecone
    checkService('Pinecone Vector DB', async () => {
      const key = process.env.PINECONE_API_KEY;
      if (!key) throw new Error('API key not configured');
      const res = await fetch('https://api.pinecone.io/indexes', {
        headers: { 'Api-Key': key },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // Upstash Redis
    checkService('Upstash Redis', async () => {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!url || !token) throw new Error('Redis not configured');
      const res = await fetch(`${url}/ping`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // Google Gemini
    checkService('Google Gemini AI', async () => {
      const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!key) throw new Error('API key not configured');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),
  ]);

  return NextResponse.json({ services });
}
