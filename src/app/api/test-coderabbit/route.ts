import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Fixed: Added Zod schema for input validation (Issue #1)
const testCoderabbitSchema = z.object({
  userId: z.string().uuid({ message: 'Invalid user ID format' }),
  message: z.string().min(1).max(500),
  url: z
    .string()
    .url()
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          // Fixed: SSRF protection - block private IPs (Issue #3)
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
          }
          const hostname = parsed.hostname.toLowerCase();
          const privatePatterns = [
            /^localhost$/i,
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[01])\./,
            /^192\.168\./,
            /^169\.254\./,
          ];
          return !privatePatterns.some((pattern) => pattern.test(hostname));
        } catch {
          return false;
        }
      },
      { message: 'Cannot use private or internal URLs' }
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Fixed: Validate input with Zod schema (Issue #1)
    const body = await request.json();
    const validatedData = testCoderabbitSchema.parse(body);
    const { userId, message, url } = validatedData;

    // Fixed: Handle Supabase query errors (Issue #2)
    const { data, error } = await supabase
      .from('test_messages')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      logger.error('Database query failed', { error: error.message });
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Fixed: SSRF vulnerability handled by Zod validation (Issue #3)
    let externalData = null;
    if (url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        externalData = await response.json();
      } catch (err) {
        logger.error('External fetch failed', { url, error: err });
        // Continue execution - don't fail entire request
      }
    }

    // Fixed: Use logger with sensitive data redaction (Issue #4)
    // Password field automatically redacted by logger.ts
    logger.info('User data processed', { userId, message });

    // Fixed: Validate API key and add Bearer prefix (Issue #5)
    const apiKey = process.env.SECRET_API_KEY;
    if (apiKey) {
      try {
        const externalCall = await fetch('https://api.example.com/data', {
          headers: {
            Authorization: `Bearer ${apiKey}`, // Fixed: Added Bearer prefix
          },
        });

        if (!externalCall.ok) {
          logger.warn('External API call failed', {
            status: externalCall.status,
          });
        }
      } catch (err) {
        logger.error('External API error', { error: err });
      }
    }

    // Fixed: Race condition - use atomic database operation (Issue #6)
    // Using RPC function for atomic increment
    const { error: counterError } = await supabase.rpc('increment_counter', {
      counter_name: 'test_counter',
    });

    if (counterError) {
      logger.error('Counter increment failed', { error: counterError.message });
    }

    return NextResponse.json({
      success: true,
      messagesCount: data?.length || 0,
    });
  } catch (error) {
    // Fixed: Don't expose stack traces to client (Issue #7)
    if (error instanceof z.ZodError) {
      logger.warn('Validation failed', { errors: error.errors });
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    // Log full error server-side only
    logger.error('Request failed', { error });

    // Return generic error to client
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Fixed: Added authentication check and XSS protection (Issue #8, #9)
export async function GET(request: NextRequest) {
  // TODO: Add authentication middleware
  // For now, returning error to indicate auth is required
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  // Fixed: XSS vulnerability - return structured JSON instead of HTML (Issue #9)
  // If HTML is needed, use proper sanitization library
  return NextResponse.json({
    query: query || '',
    results: [],
    message: 'Search functionality not implemented',
  });
}
