import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS. Use ONLY in:
// - Webhooks (Stripe, Firecrawl)
// - Server-side admin operations
// - Cron jobs
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase admin environment variables');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
