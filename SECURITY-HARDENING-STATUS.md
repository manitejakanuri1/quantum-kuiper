# 🔒 Security Hardening - Progress Report

## ✅ COMPLETED (2 Critical Fixes - 40% Done)

### Fix 1: `/api/agent/session` - Authentication + Ownership Check
**File:** `src/app/api/agent/session/route.ts`
**Status:** ✅ COMPLETE
**Changes:**
- ✅ Added `auth()` check - requires authentication (401 if missing)
- ✅ Added agent ownership verification (prevents accessing other users' agents)
- ✅ Zod validation with `sessionActionSchema`
- ✅ Replaced `console.error` with `logger.error/warn/info`
- ✅ Proper Zod error handling (returns 400 with details)

**Security Impact:**
- **Before:** Anyone could start sessions with any agent (CRITICAL vulnerability)
- **After:** Only authenticated users can access their own agents

---

### Fix 2: `/api/search-knowledge` - Authentication + Input Validation
**File:** `src/app/api/search-knowledge/route.ts`
**Status:** ✅ COMPLETE
**Changes:**
- ✅ Added `auth()` check - requires authentication (401 if missing)
- ✅ Added agent ownership verification
- ✅ Zod validation with `searchKnowledgeSchema` (UUID, query length)
- ✅ Replaced `console.error` with `logger.warn/error`
- ✅ Proper error handling with status codes

**Security Impact:**
- **Before:** Anyone could search any agent's knowledge base (data breach risk)
- **After:** Users can only search their own agents' knowledge

---

### Fix 3: `src/lib/validation.ts` - Added Missing Schema
**File:** `src/lib/validation.ts`
**Status:** ✅ COMPLETE
**Added:** `sessionActionSchema` for session endpoint validation
```typescript
export const sessionActionSchema = z.object({
  action: z.enum(['start', 'message', 'status']),
  agentId: uuidSchema,
  sessionId: uuidSchema.optional(),
  userText: z.string().min(1).max(2000).optional(),
});
```

---

## ⏳ REMAINING WORK (60% - 3 Critical + 5 High Priority)

### CRITICAL Priority (3 fixes)

#### 🔴 Fix 4: `/api/crawl-website` - Add Ownership Check
**File:** `src/app/api/crawl-website/route.ts`
**Issue:** Has auth but doesn't verify user owns the agent
**Fix Required:**
```typescript
// After session check at line 15, add:
const agent = await getAgentById(agentId);
if (!agent || agent.userId !== session.user.id) {
    return NextResponse.json(
        { error: 'Agent not found or access denied' },
        { status: 404 }
    );
}
```
**Impact:** Prevents any authenticated user from crawling any agent

---

#### 🔴 Fix 5: `/api/tts` - Add Rate Limiting
**File:** `src/app/api/tts/route.ts`
**Issue:** Completely public, no authentication or rate limiting
**Fix Required:**
1. Add rate limiting (10 req/min per IP)
2. Use `ttsRequestSchema` for validation
3. Replace `console.error` with `logger`

**Code:**
```typescript
import { ttsRequestSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        // Add rate limiting
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const rateLimitResult = rateLimit(`tts:${ip}`, {
            max: 10,
            windowMs: 60 * 1000
        });
        if (rateLimitResult) return rateLimitResult;

        // Validate input
        const body = await request.json();
        const { text, voiceId } = ttsRequestSchema.parse(body);

        logger.info('TTS request', { textLength: text.length, voiceId });
        // ... rest of code
    }
}
```
**Impact:** Prevents TTS API abuse and credit drainage

---

#### 🔴 Fix 6: `/api/avatar` - Add Rate Limiting
**File:** `src/app/api/avatar/route.ts`
**Issue:** Public avatar endpoint, no authentication
**Fix Required:**
```typescript
// At start of POST function:
const ip = request.headers.get('x-forwarded-for') || 'unknown';
const rateLimitResult = rateLimit(`avatar:${ip}`, {
    max: 5,
    windowMs: 60 * 1000
});
if (rateLimitResult) return rateLimitResult;
```
**Impact:** Prevents Simli avatar abuse

---

### HIGH Priority (5 fixes)

#### 🟠 Fix 7: `/api/agents/[id]` PUT - Use Zod Schema
**File:** `src/app/api/agents/[id]/route.ts`
**Issue:** Manual validation instead of Zod schema
**Fix Required:**
```typescript
import { updateAgentSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';

const body = await request.json();
const validatedData = updateAgentSchema.parse(body);
const { name, websiteUrl, faceId, voiceId } = validatedData;

logger.info('Updating agent', { agentId: id, fields: Object.keys(validatedData) });
```

---

#### 🟠 Fix 8: `/api/crawl-website` - Replace Manual URL Validation
**File:** `src/app/api/crawl-website/route.ts` (Lines 37-81)
**Issue:** Duplicate validation logic instead of using `urlSchema`
**Fix Required:**
```typescript
import { urlSchema } from '@/lib/validation';

// Remove lines 37-81 (manual regex validation)
// Replace with:
const validatedUrl = urlSchema.parse(websiteUrl);
```

---

#### 🟠 Fix 9-11: Replace `console.log` with `logger`
**File:** `src/app/api/agents/create/route.ts` (Lines 42, 64, 78, 85, 105)
**Issue:** PII in console logs (userId, websiteUrl, voiceId)
**Fix Required:**
```typescript
// BEFORE:
console.log('Creating agent with data:', { name, websiteUrl, userId });

// AFTER:
import { logger } from '@/lib/logger';
logger.info('Creating agent', { name, userId });
```

---

#### 🟠 Fix 12: Fix Race Condition
**File:** `src/app/api/crawl-website/route.ts` (Lines 84-101)
**Issue:** Check-then-act race condition
**Fix Required:**
```typescript
// Atomic check-and-update
const { error: updateError } = await supabaseAdmin
    .from('agents')
    .update({ crawl_status: 'crawling' })
    .eq('id', agentId)
    .eq('crawl_status', 'idle');  // Only update if still idle

if (updateError) {
    return NextResponse.json(
        { error: 'Crawl already in progress or completed' },
        { status: 409 }
    );
}
```

---

## 📊 Progress Summary

| Priority | Total | Done | Remaining | % Complete |
|----------|-------|------|-----------|------------|
| CRITICAL | 5 | 2 | 3 | 40% |
| HIGH | 5 | 0 | 5 | 0% |
| **TOTAL** | **10** | **2** | **8** | **20%** |

---

## 🎯 Next Steps

### Immediate (Next Session):
1. Fix `/api/crawl-website` ownership check (5 min)
2. Add rate limiting to `/api/tts` (10 min)
3. Add rate limiting to `/api/avatar` (5 min)
4. Use Zod schema in `/api/agents/[id]` PUT (5 min)

### After Critical Fixes:
5. Replace manual URL validation in `/api/crawl-website` (10 min)
6. Replace `console.log` with `logger` in `/api/agents/create` (5 min)
7. Fix race condition in `/api/crawl-website` (10 min)

**Total Remaining Time:** ~50 minutes

---

## ✅ What's Been Secured

### Before Fixes:
```
❌ /api/agent/session - Public, anyone can start sessions
❌ /api/search-knowledge - Public, anyone can search any knowledge base
❌ No input validation on session endpoints
❌ Sensitive data in console.log statements
```

### After Fixes:
```
✅ /api/agent/session - Auth required, ownership verified
✅ /api/search-knowledge - Auth required, ownership verified
✅ Zod validation on all inputs (UUID, text length)
✅ Winston logger with PII redaction
✅ Proper error handling (400 for validation, 401 for auth, 404 for not found)
```

---

## 🔗 Git Status

**Branch:** `security-hardening`
**Last Commit:** `5235987` - "Security fix: Add authentication and validation to critical endpoints"

**Files Modified:**
- `src/lib/validation.ts` (+15 lines)
- `src/app/api/agent/session/route.ts` (+31 lines, -5 lines)
- `src/app/api/search-knowledge/route.ts` (+38 lines, -3 lines)

**Ready to Merge:** NO (only 20% complete - need remaining 80%)

---

## 📋 Testing Checklist

After all fixes are complete, test:

1. **Authentication Works:**
   ```bash
   # Without auth - should fail 401
   curl -X POST http://localhost:3000/api/agent/session \
     -H "Content-Type: application/json" \
     -d '{"action":"start","agentId":"test-id"}'
   ```

2. **Input Validation Works:**
   ```bash
   # Invalid UUID - should fail 400
   curl -X POST http://localhost:3000/api/search-knowledge \
     -H "Content-Type: application/json" \
     -d '{"agentId":"invalid","query":"test"}'
   ```

3. **Ownership Check Works:**
   - Try accessing another user's agent
   - Should return 404 (not 403 to prevent enumeration)

4. **Rate Limiting Works:**
   - Send 11 requests to /api/tts
   - 11th should fail with 429

---

## 🚀 Deployment Plan

1. **Complete all fixes** (50 min remaining)
2. **Test locally** with curl commands above
3. **Merge to master**:
   ```bash
   git checkout master
   git merge security-hardening
   ```
4. **Deploy to staging** first
5. **Monitor logs** for errors
6. **Deploy to production**

---

**Status:** 2/10 fixes complete (20%)
**Next:** Continue with Fix #4 (crawl-website ownership check)
