import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Sanitize the `next` redirect parameter to prevent open redirects.
 * Only allows relative paths starting with / that don't escape to external domains.
 */
function sanitizeRedirectPath(next: string | null): string {
  if (!next) return '/dashboard';

  // Must start with exactly one slash (not // which browsers treat as protocol-relative)
  // Must not contain backslashes (which some browsers normalize to forward slashes)
  // Must not contain protocol patterns like /foo:bar
  if (
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('\\') ||
    /^\/[^/]*:/i.test(next)
  ) {
    return '/dashboard';
  }

  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to login with an error if code exchange failed
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}
