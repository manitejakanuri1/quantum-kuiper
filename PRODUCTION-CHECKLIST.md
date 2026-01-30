# Production Deployment Checklist

Complete this checklist before deploying quantum-kuiper to production.

## ☑️ Security (CRITICAL)

### Environment Variables
- [ ] Rotate ALL API keys from development
- [ ] Generate new `AUTH_SECRET` (min 32 chars, use `openssl rand -base64 32`)
- [ ] Set all required env vars in production environment
- [ ] Remove `.env.local` from version control (verify with `git status`)
- [ ] Verify `.env.example` has placeholder values only

### Authentication & Authorization
- [ ] Test login/signup flows
- [ ] Verify password hashing works (bcrypt 10 rounds)
- [ ] Test session expiration
- [ ] Verify unauthorized access returns 401/403
- [ ] Test agent ownership checks on all update/delete endpoints

### API Security
- [ ] Add rate limiting to all public endpoints
- [ ] Implement CSRF protection
- [ ] Add request body size limits (10MB max)
- [ ] Validate all user inputs with Zod or similar
- [ ] Test SSRF protection (try crawling localhost)
- [ ] Add timeouts to all external API calls (30-60s)

### Database
- [ ] Run all SQL migrations in correct order
- [ ] Verify Row Level Security policies are enabled
- [ ] Test that users can't access other users' data
- [ ] Add indexes for common queries (see SECURITY-FIXES-APPLIED.md)
- [ ] Enable Supabase database backups
- [ ] Set up connection pooling (if using external DB)

### Headers & Middleware
- [ ] Add security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- [ ] Configure CORS properly (whitelist allowed origins)
- [ ] Add Content Security Policy (CSP)
- [ ] Enable HTTPS only (HSTS header)
- [ ] Set secure cookie flags (httpOnly, secure, sameSite)

---

## ☑️ Performance

### Frontend
- [ ] Run `npm run build` to verify production build works
- [ ] Check bundle size with `npm run build` output
- [ ] Verify code splitting is working
- [ ] Test lazy loading of components
- [ ] Optimize images (use Next.js Image component)
- [ ] Test page load time (<3s initial load)
- [ ] Verify animations don't block rendering

### Backend
- [ ] Test API response times (<500ms average)
- [ ] Verify embedding generation is cached
- [ ] Check Q&A matching uses RPC (not embedding loops)
- [ ] Run backfill script for existing Q&A pairs
- [ ] Test vector search performance with 100+ Q&A pairs
- [ ] Monitor memory usage under load

### Database
- [ ] Add indexes for common queries
- [ ] Test query performance with realistic data volume
- [ ] Enable query performance insights in Supabase
- [ ] Set up connection pooling
- [ ] Test pagination on large result sets

---

## ☑️ Monitoring & Logging

### Logging
- [ ] Replace `console.log` with proper logger (winston/pino)
- [ ] Remove emoji logging from production code
- [ ] Don't log sensitive data (passwords, API keys, full emails)
- [ ] Set up log aggregation (Datadog, CloudWatch, etc.)
- [ ] Add request ID tracking for debugging

### Monitoring
- [ ] Set up uptime monitoring (Pingdom, UptimeRobot)
- [ ] Add error tracking (Sentry, Rollbar)
- [ ] Monitor API response times
- [ ] Track key metrics (sessions created, messages sent, crawls completed)
- [ ] Set up alerts for high error rates

### Health Checks
- [ ] Add `/api/health` endpoint
- [ ] Verify database connectivity in health check
- [ ] Check external API status (Supabase, Deepgram, etc.)
- [ ] Monitor backend service health

---

## ☑️ Testing

### Unit Tests
- [ ] Write tests for critical functions (auth, retrieval, embeddings)
- [ ] Test edge cases (empty inputs, invalid UUIDs, etc.)
- [ ] Test error handling paths

### Integration Tests
- [ ] Test full user signup → agent creation → session flow
- [ ] Test crawl-website → embedding generation → retrieval flow
- [ ] Test WebSocket connections
- [ ] Test voice agent interactions end-to-end

### Security Tests
- [ ] Test SQL injection attempts
- [ ] Test XSS attempts in user inputs
- [ ] Test CSRF protection
- [ ] Test SSRF protection (internal URLs)
- [ ] Test authorization bypasses
- [ ] Run dependency vulnerability scan (`npm audit`)

---

## ☑️ Configuration

### Next.js Config
- [ ] Verify `reactStrictMode: true`
- [ ] Enable `swcMinify: true`
- [ ] Set `removeConsole: true` for production
- [ ] Configure security headers
- [ ] Set up rewrites/redirects if needed

### Backend Config
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Set connection pool size
- [ ] Configure timeout values
- [ ] Set up graceful shutdown

### Database Config
- [ ] Enable RLS on all tables
- [ ] Set up replication (if needed)
- [ ] Configure backup schedule
- [ ] Set connection limits
- [ ] Enable query logging

---

## ☑️ Deployment

### Pre-Deployment
- [ ] Run `npm run build` locally to verify build succeeds
- [ ] Test production build locally (`npm run start`)
- [ ] Run database migrations on staging
- [ ] Test on staging environment
- [ ] Review recent commits for any issues

### Deployment Steps
- [ ] Deploy database migrations first
- [ ] Deploy backend service
- [ ] Deploy frontend application
- [ ] Verify health checks pass
- [ ] Test critical user flows
- [ ] Monitor error logs for 30 minutes

### Post-Deployment
- [ ] Verify DNS resolves correctly
- [ ] Test SSL certificate is valid
- [ ] Check all environment variables are set
- [ ] Test authentication flows
- [ ] Verify external API integrations work
- [ ] Monitor performance metrics
- [ ] Check error rates

---

## ☑️ Documentation

- [ ] Update README with production setup instructions
- [ ] Document all environment variables in `.env.example`
- [ ] Create runbook for common issues
- [ ] Document database schema
- [ ] Create API documentation (OpenAPI/Swagger)
- [ ] Document deployment process
- [ ] Create incident response plan

---

## ☑️ Legal & Compliance

- [ ] Add Terms of Service
- [ ] Add Privacy Policy
- [ ] Implement GDPR compliance (if applicable)
- [ ] Add data retention policy
- [ ] Implement user data export
- [ ] Implement user data deletion
- [ ] Add cookie consent banner (if applicable)

---

## ☑️ Scalability

- [ ] Set up auto-scaling (if applicable)
- [ ] Configure CDN for static assets
- [ ] Set up database read replicas (if needed)
- [ ] Implement caching strategy (Redis)
- [ ] Test performance under load
- [ ] Plan for traffic spikes

---

## Environment Variables Reference

### Production Environment Variables
```bash
# Authentication
AUTH_SECRET="<generate-new-32-char-secret>"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# Backend
NEXT_PUBLIC_BACKEND_URL="https://api.yourdomain.com"

# API Keys (ROTATE THESE - don't reuse dev keys)
FISHAUDIO_API_KEY="<new-production-key>"
FIRECRAWL_API_KEY="<new-production-key>"

# Optional
NEXT_PUBLIC_SIMLI_API_KEY="<new-production-key>"
NEXT_PUBLIC_DEEPGRAM_API_KEY="<new-production-key>"

# Environment
NODE_ENV="production"
```

---

## SQL Migrations Order

Run these SQL files in Supabase in this exact order:

1. `supabase-schema.sql` (base schema)
2. `supabase-rag-schema.sql` (RAG tables)
3. `supabase-qa-pairs-schema.sql` (Q&A tables)
4. `supabase-vector-migration.sql` (vector extension)
5. `supabase-qa-embeddings-migration.sql` (Q&A embeddings - CRITICAL)
6. `supabase-qa-matching-rpc.sql` (vector search function - CRITICAL)
7. `supabase-user-questions-schema.sql` (user questions tracking)
8. `supabase-agent-fallback-migration.sql` (fallback responses)

Then run:
```bash
cd backend
node backfill-qa-embeddings.js
```

---

## Performance Targets

- [ ] Initial page load: < 3 seconds
- [ ] API response time: < 500ms (p95)
- [ ] Q&A matching: < 100ms (with embeddings)
- [ ] Vector search: < 200ms (with index)
- [ ] WebSocket latency: < 100ms
- [ ] Crawl completion: < 60 seconds (per site)
- [ ] TTS generation: < 2 seconds
- [ ] Uptime: > 99.5%

---

## Rollback Plan

If deployment fails:

1. **Frontend Issues**:
   - Revert to previous Vercel/Netlify deployment
   - Check build logs for errors

2. **Backend Issues**:
   - Restart backend service
   - Check environment variables
   - Review recent commits

3. **Database Issues**:
   - Restore from backup
   - Roll back migrations if needed
   - Check RLS policies

4. **Communication**:
   - Post status update
   - Notify affected users
   - Document incident

---

## Common Issues & Solutions

### Issue: "AUTH_SECRET must be set"
**Solution**: Set `AUTH_SECRET` environment variable (min 32 chars)

### Issue: "Cannot crawl private or internal URLs"
**Solution**: This is expected - SSRF protection is working

### Issue: Slow Q&A matching (>1 second)
**Solution**: Run `node backend/backfill-qa-embeddings.js` to generate embeddings

### Issue: "Agent not found" or 403 errors
**Solution**: Check user owns the agent they're trying to access

### Issue: WebSocket connection fails
**Solution**: Check CORS configuration and backend URL

---

Last Updated: 2026-01-30

## Quick Launch Commands

```bash
# Frontend
npm run build
npm run start

# Backend
cd backend
npm install
npm run dev

# Database
# Run migrations in Supabase SQL Editor
# Then run: node backend/backfill-qa-embeddings.js
```
