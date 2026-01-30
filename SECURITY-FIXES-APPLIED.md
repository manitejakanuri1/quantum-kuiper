# Security Fixes Applied

This document tracks all security fixes and improvements made to the quantum-kuiper project.

## Critical Fixes Applied ✅

### 1. Removed Hardcoded Secrets (CRITICAL)
**File**: `src/lib/auth.ts`
- ❌ **Before**: Had fallback secret `'dev-secret-CHANGE-IN-PRODUCTION-minimum-32-chars'`
- ✅ **After**: Removed fallback, throws error if `AUTH_SECRET` not set
- ✅ **After**: Enforces minimum 32-character requirement

**Impact**: Prevents accidental use of weak default secrets in production.

---

### 2. Fixed Hardcoded Backend URL (HIGH)
**File**: `src/app/api/crawl-website/route.ts`
- ❌ **Before**: Hardcoded `'http://localhost:8080'`
- ✅ **After**: Uses `process.env.NEXT_PUBLIC_BACKEND_URL` with fallback
- ✅ **After**: Added 60-second timeout with AbortController

**Impact**: Works in production environments, prevents indefinite hangs.

---

### 3. Added Authorization Check (HIGH)
**File**: `src/app/api/sessions/route.ts`
- ❌ **Before**: Any user could create sessions for any agent
- ✅ **After**: Verifies user owns the agent before creating session
- ✅ **After**: Returns 403 Forbidden if unauthorized

**Impact**: Prevents unauthorized session creation across user boundaries.

---

### 4. SSRF Protection (MEDIUM)
**File**: `src/app/api/crawl-website/route.ts`
- ❌ **Before**: Could crawl localhost, private IPs, file:// URLs
- ✅ **After**: Validates URL protocol (http/https only)
- ✅ **After**: Blocks private IP ranges and localhost
- ✅ **After**: URL length validation (max 2000 chars)

**Blocked patterns**:
- `localhost`, `127.x.x.x`
- Private IPv4: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`
- Link-local: `169.254.x.x`
- Private IPv6: `::1`, `fe80::`, `fc00::`, `fd00::`

**Impact**: Prevents Server-Side Request Forgery attacks.

---

### 5. Created `.env.example` Template
**File**: `.env.example` (NEW)
- ✅ Created template with all required environment variables
- ✅ Placeholder values for sensitive keys
- ✅ Documentation for each variable

**Impact**: Developers know which env vars are needed without exposing secrets.

---

## Still Needs Fixing ⚠️

### Critical Priority

1. **Rotate ALL API Keys** (IMMEDIATE ACTION REQUIRED)
   - File: `.env.local` contains REAL API keys
   - **Action**: Generate new keys for:
     - Simli API Key
     - FishAudio API Key
     - Firecrawl API Key
     - Deepgram API Key
     - Supabase Service Role Key
   - **Reason**: Keys were exposed in project files

2. **Move Client-Side API Keys to Server** (HIGH)
   - Files affected:
     - `src/lib/simile.ts` - `NEXT_PUBLIC_SIMLI_API_KEY`
     - `src/lib/deepgram.ts` - `NEXT_PUBLIC_DEEPGRAM_API_KEY`
   - **Action**: Create server-side API routes, remove `NEXT_PUBLIC_` prefix
   - **Impact**: Prevents API key theft from browser

3. **Add Agent Ownership Check** (HIGH)
   - File: `src/app/api/agents/[id]/route.ts`
   - **Issue**: PUT endpoint doesn't verify user owns agent
   - **Fix**: Add `if (agent.userId !== session.user.id)` check

### Medium Priority

4. **Add Input Validation**
   - Use Zod or io-ts for request body validation
   - Sanitize string inputs (agent names, descriptions)
   - Validate UUID formats for IDs

5. **Add Rate Limiting**
   - Apply to expensive endpoints:
     - `/api/crawl-website` (5 per hour)
     - `/api/search-knowledge` (60 per minute)
     - `/api/tts` (100 per minute)
   - Use Redis or in-memory store

6. **Remove Console Logging**
   - Replace with proper logging library (winston/pino)
   - Remove emoji logging
   - Don't log sensitive data (UUIDs, emails)

7. **Add Database Indexes**
   ```sql
   CREATE INDEX idx_website_pages_agent_content
     ON website_pages(agent_id, extracted_text);
   CREATE INDEX idx_chunks_kb_content
     ON document_chunks(kb_id, content);
   CREATE INDEX idx_messages_session_time
     ON messages(session_id, created_at);
   ```

8. **Improve RLS Policies**
   ```sql
   -- Change from:
   CREATE POLICY "Anyone can create sessions" ON sessions
     FOR INSERT WITH CHECK (true);

   -- To:
   CREATE POLICY "Authenticated users can create sessions" ON sessions
     FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
   ```

### Low Priority

9. **Add Request Timeouts Globally**
   - Set default fetch timeout (30s)
   - Use AbortController pattern

10. **Add CSRF Protection**
    - Implement double-submit cookie pattern
    - Validate origin header

11. **Add Content Security Policy Headers**
    ```typescript
    // next.config.ts
    headers: async () => [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
    ```

---

## Environment Variables Checklist

### Required for Production ✅
- [ ] `AUTH_SECRET` (min 32 chars)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `FISHAUDIO_API_KEY`
- [ ] `FIRECRAWL_API_KEY`
- [ ] `NEXT_PUBLIC_BACKEND_URL`

### Optional (Feature-Dependent)
- [ ] `NEXT_PUBLIC_SIMLI_API_KEY` (if using Simli)
- [ ] `NEXT_PUBLIC_DEEPGRAM_API_KEY` (if using Deepgram STT)
- [ ] `OPENAI_API_KEY` (if using OpenAI)

---

## Testing Security Fixes

### Test 1: Auth Secret Validation
```bash
# Should fail with error
unset AUTH_SECRET
npm run dev

# Should succeed
export AUTH_SECRET="my-32-character-secret-key-here-123456"
npm run dev
```

### Test 2: SSRF Protection
```bash
curl -X POST http://localhost:3000/api/crawl-website \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl": "http://localhost:8080", "agentId": "test"}'

# Expected: 400 Bad Request "Cannot crawl private or internal URLs"
```

### Test 3: Session Authorization
```bash
# Try creating session for another user's agent
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"agent_id": "another-users-agent-id"}'

# Expected: 403 Forbidden
```

---

## Security Audit Checklist

- [x] Remove hardcoded secrets
- [x] Validate environment variables at startup
- [x] Add SSRF protection
- [x] Add authorization checks
- [x] Add request timeouts
- [ ] Rotate exposed API keys
- [ ] Move client-side API keys to server
- [ ] Add rate limiting
- [ ] Add input validation (Zod)
- [ ] Remove console logging
- [ ] Add database indexes
- [ ] Improve RLS policies
- [ ] Add CSP headers
- [ ] Add CSRF protection
- [ ] Security headers middleware
- [ ] Dependency vulnerability scan

---

## Next Steps

1. **IMMEDIATE**: Rotate all API keys in `.env.local`
2. **URGENT**: Move Simli and Deepgram keys to server-side
3. **HIGH**: Add authorization check to agent update endpoint
4. **MEDIUM**: Implement rate limiting on expensive endpoints
5. **MEDIUM**: Add Zod validation to all API routes

---

Last Updated: 2026-01-30
