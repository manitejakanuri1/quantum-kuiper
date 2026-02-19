// Request validation utilities

import { NextResponse } from 'next/server';

/**
 * Validate that the request has a JSON Content-Type header.
 * Returns a 415 response if invalid, or null if the check passes.
 */
export function requireJsonContentType(request: Request): NextResponse | null {
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 415 }
    );
  }
  return null;
}
