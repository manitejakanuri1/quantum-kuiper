# Security Guidelines

## 🔒 Security Fixes Implemented

### ✅ 1. Password Hashing (CRITICAL - FIXED)
- **Status**: ✅ Fixed
- **Implementation**: bcryptjs with 10 salt rounds
- **Location**: `src/lib/auth.ts`
- All passwords are now hashed before storage
- Password comparison uses bcrypt.compare()

### ✅ 2. API Key Protection (CRITICAL - FIXED)
- **Status**: ✅ Fixed
- **Implementation**: Removed hardcoded keys from client code
- **Location**: `src/lib/fishaudio.ts`
- All API calls must go through server-side routes
- No API keys exposed in client bundle

### ✅ 3. Strong AUTH_SECRET (HIGH - FIXED)
- **Status**: ✅ Fixed
- **Implementation**: Required in production, minimum 32 characters
- **Location**: `src/lib/auth.ts`
- Production deployment will fail if AUTH_SECRET not set
- Development uses clearly labeled temporary secret

### ✅ 4. Rate Limiting (HIGH - FIXED)
- **Status**: ✅ Fixed
- **Implementation**: Custom rate limiting middleware
- **Location**: `src/lib/rate-limit.ts`
- Login: 5 attempts per 15 minutes per IP
- Agent creation: 10 per hour per user
- Returns 429 status with Retry-After header

### ✅ 5. Environment Variable Protection (MEDIUM - FIXED)
- **Status**: ✅ Fixed
- **Implementation**: .env.local in .gitignore
- **Action Required**: Rotate all exposed API keys
- Never commit .env files to version control

## 🔐 Additional Security Features

### Session Management
- JWT-based sessions with 30-day expiration
- Automatic session timeout
- Secure cookie settings (httpOnly, secure in production)

### Input Validation
- Email format validation in database
- Required field validation in API routes
- UUID validation for identifiers

### Database Security
- Row Level Security (RLS) enabled on all tables
- Proper foreign key constraints with CASCADE
- Index optimization for performance

## 🚨 IMPORTANT: Before Production Deployment

### 1. Rotate ALL API Keys
The following keys were exposed and MUST be rotated:

```bash
# DO NOT USE THESE - THEY ARE COMPROMISED
❌ SIMILE_API_KEY=2rzzdgcc1bwzpyw25ecqg
❌ FISHAUDIO_API_KEY=30d3e0ad87334edfab5058d0ef861762
❌ SUPABASE_ANON_KEY=eyJhbGc...
❌ FIRECRAWL_API_KEY=fc-a7278d523597458181b858d90eff5349
❌ DEEPGRAM_API_KEY=6a869ff6aaf6915c8b8f33f472b0d78b29f3f1eb
```

### 2. Generate New Secrets
```bash
# Generate strong AUTH_SECRET (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in production environment:
AUTH_SECRET=<your-generated-secret>
```

### 3. Environment Variables Checklist
- [ ] Rotate all API keys
- [ ] Generate strong AUTH_SECRET
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS only
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging

### 4. Database Setup
```bash
# Run in Supabase SQL Editor:
1. supabase-schema.sql
2. supabase-rag-schema.sql
3. supabase-website-data.sql
```

## 🛡️ Security Best Practices

### For Developers
1. ✅ Never commit API keys or secrets
2. ✅ Always use environment variables
3. ✅ Hash passwords with bcrypt (10+ rounds)
4. ✅ Validate all user inputs
5. ✅ Use parameterized queries (Supabase handles this)
6. ✅ Implement rate limiting on all public endpoints
7. ✅ Log security events (failed logins, rate limits)
8. ✅ Keep dependencies updated (`npm audit`)

### For Deployment
1. ✅ Use HTTPS only (TLS 1.3)
2. ✅ Set secure cookie flags
3. ✅ Enable HSTS headers
4. ✅ Configure CSP (Content Security Policy)
5. ✅ Set up WAF (Web Application Firewall)
6. ✅ Enable DDoS protection
7. ✅ Regular security audits
8. ✅ Backup database regularly

## 📊 Security Headers (Add to next.config.ts)

```typescript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
]

export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}
```

## 🔍 Security Audit Log

| Date | Issue | Severity | Status |
|------|-------|----------|--------|
| 2026-01-23 | Plaintext passwords | CRITICAL | ✅ Fixed |
| 2026-01-23 | Hardcoded API keys | CRITICAL | ✅ Fixed |
| 2026-01-23 | Weak AUTH_SECRET | HIGH | ✅ Fixed |
| 2026-01-23 | No rate limiting | HIGH | ✅ Fixed |
| 2026-01-23 | Exposed env vars | MEDIUM | ✅ Fixed |

## 📞 Reporting Security Issues

If you discover a security vulnerability, please email:
- **DO NOT** open a public GitHub issue
- Email: security@yourcompany.com
- Include detailed description and reproduction steps
- We will respond within 48 hours

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [bcrypt Documentation](https://github.com/kelektiv/node.bcrypt.js)
- [Rate Limiting Strategies](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

---

**Last Updated**: 2026-01-23
**Next Review**: 2026-02-23
