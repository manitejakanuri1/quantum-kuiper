# Migrate from Firebase to Supabase Workflow

## Objective
Migrate quantum-kuiper from Firebase (Firestore) to Supabase (PostgreSQL) while maintaining all functionality.

## Current State Assessment
- ✅ Supabase client already exists (`@supabase/supabase-js` v2.89.0)
- ✅ Python backend has complete Supabase implementation (`streamlit_backend/supabase_client.py`)
- ⚠️ Frontend still uses Firebase for auth and database
- ⚠️ Firebase errors occurring (WriteBatch, instanceof issues)

## Required Inputs
- Supabase project URL
- Supabase anon/public key
- Supabase service role key (for admin operations)
- Decision: Keep NextAuth or switch to Supabase Auth?

## Migration Strategy

### Phase 1: Setup Supabase Project
1. Create Supabase project at https://supabase.com
2. Note down project URL and keys
3. Update `.env.local` with Supabase credentials

### Phase 2: Database Schema Migration
1. Export current Firestore data structure
2. Design PostgreSQL schema matching Firestore collections
3. Create tables in Supabase
4. Set up Row Level Security (RLS) policies
5. Create necessary indexes

### Phase 3: Code Migration (Frontend)
1. Create `src/lib/supabase.ts` (Supabase client)
2. Update `src/lib/db.ts` to use Supabase instead of Firestore
3. Update authentication to use Supabase Auth
4. Update API routes to use Supabase
5. Remove Firebase dependencies

### Phase 4: Testing & Validation
1. Test user authentication
2. Test CRUD operations
3. Test real-time subscriptions (if used)
4. Verify all API endpoints work
5. Check for performance issues

### Phase 5: Cleanup
1. Remove Firebase packages
2. Remove Firebase configuration files
3. Update documentation
4. Archive old Firebase data

## Tools Used
- `tools/create_supabase_schema.py` - Generate SQL schema from Firestore structure
- `tools/migrate_firebase_data.py` - Export data from Firebase, import to Supabase
- `tools/update_env_config.py` - Update environment variables

## Expected Outputs
- Fully functional app using Supabase
- All data migrated from Firebase to Supabase
- Updated documentation
- Reduced bundle size (removed Firebase SDK)

## Edge Cases

### Data Migration Failures
- **Issue**: Some Firestore data doesn't translate cleanly to SQL
- **Solution**: Custom transformation scripts for complex nested data

### Authentication Breaking
- **Issue**: Existing user sessions become invalid
- **Solution**: Implement migration period with dual auth support, notify users

### Real-time Features
- **Issue**: Firestore real-time listeners need replacement
- **Solution**: Use Supabase Realtime for equivalent functionality

### Performance Differences
- **Issue**: Query patterns may perform differently in PostgreSQL
- **Solution**: Add appropriate indexes, optimize queries

## Benefits of Migration

### Technical Benefits
- ✅ Relational database (better for complex queries)
- ✅ Built-in PostgreSQL features (functions, triggers, views)
- ✅ Better type safety with generated TypeScript types
- ✅ Row Level Security (RLS) for fine-grained access control
- ✅ Realtime subscriptions without extra cost
- ✅ Storage included (for files/media)
- ✅ Edge Functions (serverless)

### Cost Benefits
- ✅ More generous free tier
- ✅ Predictable pricing
- ✅ No per-operation charges

### Developer Experience
- ✅ SQL (familiar, powerful)
- ✅ Better debugging tools
- ✅ Direct database access
- ✅ Auto-generated REST API
- ✅ Auto-generated GraphQL API

## Timeline Estimate
- Phase 1 (Setup): 30 minutes
- Phase 2 (Schema): 2-3 hours
- Phase 3 (Code Migration): 4-6 hours
- Phase 4 (Testing): 2-3 hours
- Phase 5 (Cleanup): 1 hour

**Total**: 1-2 days of development work

## Decision Points

### Authentication Strategy
**Option A**: Keep NextAuth + Supabase Database
- Pros: Minimal auth code changes
- Cons: Two systems to manage

**Option B**: Switch to Supabase Auth + Supabase Database
- Pros: Unified system, simpler architecture
- Cons: Need to rewrite auth logic

**Recommendation**: Start with Option A, migrate to B later if needed

### Data Migration Timing
**Option A**: Gradual migration (dual-write period)
- Pros: Safer, can rollback
- Cons: More complex, longer timeline

**Option B**: Direct cutover (all at once)
- Pros: Faster, cleaner
- Cons: Higher risk, downtime required

**Recommendation**: Option A for production, Option B for development

## Next Steps

1. **Decide on Supabase Project**
   - Create new project or use existing?
   - What region?

2. **Plan Database Schema**
   - Review current Firestore collections
   - Design equivalent PostgreSQL tables
   - Plan RLS policies

3. **Set Up Development Environment**
   - Add Supabase credentials to `.env.local`
   - Create `src/lib/supabase.ts`
   - Test basic connection

4. **Start Migration**
   - Begin with one feature (e.g., user management)
   - Test thoroughly
   - Expand to other features

## Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase + Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Firebase to Supabase Migration Guide](https://supabase.com/docs/guides/migrations/firebase)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

**Ready to proceed?** Let's start with Phase 1!
