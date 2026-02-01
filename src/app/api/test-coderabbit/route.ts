import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Test endpoint to demonstrate CodeRabbit's review capabilities
/**
 * Process incoming POST requests to record a test message, optionally fetch external data, and increment a counter.
 *
 * @returns A JSON response: `{ success: true }` on success; on failure a JSON object containing `error` (error message) and `stack` with HTTP status 500.
 */

export async function POST(request: NextRequest) {
  try {
    // ISSUE 1: No input validation - CodeRabbit should flag this
    const body = await request.json();
    const { userId, message, url } = body;

    // ISSUE 2: SQL injection vulnerability - using string interpolation
    const { data, error } = await supabase
      .from('test_messages')
      .select('*')
      .eq('user_id', userId); // This is actually safe, but let's add a raw query

    // ISSUE 3: SSRF vulnerability - not validating URL before fetching
    if (url) {
      const response = await fetch(url); // Could access internal services!
      const externalData = await response.json();
    }

    // ISSUE 4: Sensitive data in logs
    console.log('User data:', { userId, message, password: body.password });

    // ISSUE 5: No error handling for external API call
    const apiKey = process.env.SECRET_API_KEY;
    const externalCall = await fetch('https://api.example.com/data', {
      headers: { Authorization: apiKey }, // Missing Bearer prefix
    });

    // ISSUE 6: Race condition - not using transaction
    const count = await supabase.from('counters').select('count').single();
    await supabase
      .from('counters')
      .update({ count: count.data.count + 1 });

    return NextResponse.json({ success: true });
  } catch (error) {
    // ISSUE 7: Returning sensitive error details to client
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

/**
 * Handles GET requests and returns a JSON payload containing an HTML snippet with the `q` query parameter.
 *
 * Extracts the `q` search parameter from the request URL and includes it verbatim in the `html` property.
 *
 * @returns A NextResponse whose JSON body is an object `{ html: string }` where `html` is an HTML string containing the raw `q` value.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  // ISSUE 9: XSS vulnerability - not sanitizing user input
  return NextResponse.json({
    html: `<div>Search results for: ${query}</div>`,
  });
}