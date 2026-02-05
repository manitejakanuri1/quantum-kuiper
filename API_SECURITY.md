# API Security Guidelines

## Authentication Patterns

### Using `withAuth()` Middleware (Recommended)

The `withAuth()` wrapper automatically handles authentication and provides the user object:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getSecurityHeaders } from '@/lib/security-utils';

export const GET = withAuth(async (request: NextRequest, user) => {
    // user.userId and user.email are guaranteed to exist
    // Automatically returns 401 if not authenticated
    
    const data = await fetchUserData(user.userId);
    
    return NextResponse.json(data, { 
        headers: getSecurityHeaders() 
    });
});
```

### Checking Agent Ownership

For routes that modify agent data, verify ownership:

```typescript
import { requireOwnership } from '@/lib/auth-middleware';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await requireOwnership(request, id);
    
    if (!user) {
        return NextResponse.json(
            { error: 'Forbidden' }, 
            { status: 403 }
        );
    }
    
    // User owns this agent, proceed with update
    await updateAgent(id, updates);
}
```

## Input Validation

Always validate and sanitize input:

```typescript
import { validateAgentName, validateWebsiteUrl, sanitizeInput } from '@/lib/security-utils';

const body = await request.json();

// Validate agent name
const nameResult = validateAgentName(body.name);
if (!nameResult.valid) {
    return NextResponse.json(
        { error: nameResult.error },
        { status: 400 }
    );
}

// Validate URL
const urlResult = validateWebsiteUrl(body.websiteUrl);
if (!urlResult.valid) {
    return NextResponse.json(
        { error: urlResult.error },
        { status: 400 }
    );
}

// Use sanitized values
const agent = await createAgent({
    name: nameResult.sanitized,
    websiteUrl: urlResult.sanitized,
});
```

## Rate Limiting

Apply rate limits to prevent abuse:

```typescript
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/auth-middleware';

const identifier = getRateLimitIdentifier(request, user.userId);
const rateLimit = checkRateLimit(identifier, 100, 15 * 60 * 1000); // 100 per 15 min

if (!rateLimit.allowed) {
    return NextResponse.json(
        { 
            error: 'Rate limit exceeded',
            resetAt: rateLimit.resetAt 
        },
        { 
            status: 429,
            headers: {
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(rateLimit.resetAt),
            }
        }
    );
}
```

## Security Headers

Always include security headers in responses:

```typescript
import { getSecurityHeaders } from '@/lib/security-utils';

return NextResponse.json(data, {
    headers: getSecurityHeaders()
});
```

This adds:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- And more

## Public Endpoints

For public endpoints (e.g., embed codes), use API key validation:

```typescript
import { validateApiKey } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
    const hasValidKey = await validateApiKey(request);
    
    if (!hasValidKey) {
        return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
        );
    }
    
    // Proceed with request
}
```

## Complete Example

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, checkRateLimit, getRateLimitIdentifier } from '@/lib/auth-middleware';
import { validateAgentName, getSecurityHeaders } from '@/lib/security-utils';
import { createAgent } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const POST = withAuth(async (request: NextRequest, user) => {
    try {
        // Rate limiting
        const identifier = getRateLimitIdentifier(request, user.userId);
        const rateLimit = checkRateLimit(identifier, 10, 60 * 60 * 1000); // 10/hour
        
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded' },
                { status: 429 }
            );
        }
        
        // Input validation
        const body = await request.json();
        const nameResult = validateAgentName(body.name);
        
        if (!nameResult.valid) {
            return NextResponse.json(
                { error: nameResult.error },
                { status: 400 }
            );
        }
        
        // Create agent
        const agent = await createAgent({
            id: uuidv4(),
            userId: user.userId,
            name: nameResult.sanitized,
            status: 'active',
            createdAt: new Date(),
        });
        
        return NextResponse.json(
            { success: true, agent },
            { headers: getSecurityHeaders() }
        );
    } catch (error) {
        console.error('Error creating agent:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: getSecurityHeaders() }
        );
    }
});
```
