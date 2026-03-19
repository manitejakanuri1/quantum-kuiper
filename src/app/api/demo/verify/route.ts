import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

const bodySchema = z.object({
  email: z.string().email('Invalid email address'),
  turnstileToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { email, turnstileToken } = parsed.data;
    const ip = getClientIdentifier(request);

    // Rate limit: 2 demos per IP per 24 hours
    const rateLimitResult = await rateLimit(`demo:${ip}`, {
      max: 2,
      windowMs: 24 * 60 * 60 * 1000,
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verify Turnstile token if configured
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileToken) {
      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
          }),
        }
      );

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return NextResponse.json(
          { error: 'Verification failed. Please try again.' },
          { status: 403 }
        );
      }
    }

    // Store demo lead in Supabase
    const supabase = createAdminClient();
    await supabase.from('demo_leads').insert({
      email,
      ip_address: ip,
    });

    // Generate session token
    const sessionToken = uuidv4();

    return NextResponse.json({
      success: true,
      sessionToken,
      expiresIn: 180,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
