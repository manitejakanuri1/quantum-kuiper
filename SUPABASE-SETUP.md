# Supabase Database Setup Guide

## ✅ Current Status

**Database Connection**: ✅ Active and Verified
**Schema Status**: ✅ All tables accessible
**Security Fixes**: ✅ Compatible with bcrypt password hashing

---

## 📊 Database Schema Overview

### **Schema Files** (Run in order)

1. **`supabase-schema.sql`** - Main schema (✅ Applied)
   - Users table (with password field for bcrypt hashes)
   - Agents table
   - Voices table
   - Knowledge bases table
   - Document chunks table
   - Sessions table
   - Messages table
   - Row Level Security (RLS) policies
   - Indexes and triggers

2. **`supabase-rag-schema.sql`** - RAG extensions
   - Extends document_chunks table
   - Adds trigram indexes for fuzzy matching
   - Q&A structured retrieval
   - Keyword-based search

3. **`supabase-website-data.sql`** - Website crawling
   - Website pages table
   - Firecrawl integration support

4. **`supabase-firecrawl-migration.sql`** - Firecrawl migration
   - Additional Firecrawl-specific tables

---

## 🔐 Security Configuration

### **Password Storage**
The database is **fully compatible** with the new bcrypt security fixes:

```sql
-- Users table password field
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,  -- ✅ Stores bcrypt hashes (60 chars)
  ...
);
```

**How it works:**
- Old plaintext passwords (if any exist) can be migrated
- New signups automatically use bcrypt hashing
- Login compares hashed passwords correctly
- Password field is TEXT type (supports bcrypt's 60-character hashes)

### **Row Level Security (RLS)**

All tables have RLS enabled with proper policies:

```sql
-- Users can only read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (id = auth.uid());

-- Users can only manage their own agents
CREATE POLICY "Users can read own agents" ON agents
  FOR SELECT USING (user_id = auth.uid());
```

**Service Role Key**: Bypasses RLS for server-side operations (used in `src/lib/db.ts`)

---

## 🗄️ Database Tables

| Table | Purpose | RLS | Status |
|-------|---------|-----|--------|
| **users** | User accounts with bcrypt passwords | ✅ | ✅ Active |
| **agents** | AI voice agents | ✅ | ✅ Active |
| **voices** | Available voice options | ✅ | ✅ Active |
| **knowledge_bases** | Agent knowledge sources | ✅ | ✅ Active |
| **document_chunks** | RAG content chunks | ✅ | ✅ Active |
| **sessions** | Conversation sessions | ✅ | ✅ Active |
| **messages** | Chat messages | ✅ | ✅ Active |

---

## 🔧 Environment Variables

### **Required Supabase Variables**

```bash
# Public variables (safe for client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Secret variable (server-side ONLY)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### **How to Get These Values**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Setup Instructions

### **Step 1: Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose a name and password
4. Wait for project to be ready (~2 minutes)

### **Step 2: Run SQL Schema**
1. Go to **SQL Editor** in Supabase dashboard
2. Run these files **in order**:

```sql
-- 1. Main schema (REQUIRED)
-- Copy/paste contents of supabase-schema.sql
-- Click "Run"

-- 2. RAG extensions (REQUIRED for knowledge base)
-- Copy/paste contents of supabase-rag-schema.sql
-- Click "Run"

-- 3. Website data (REQUIRED for website crawling)
-- Copy/paste contents of supabase-website-data.sql
-- Click "Run"

-- 4. Firecrawl migration (OPTIONAL)
-- Copy/paste contents of supabase-firecrawl-migration.sql
-- Click "Run"
```

### **Step 3: Configure Environment Variables**
1. Copy API keys from Supabase dashboard
2. Update `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### **Step 4: Test Connection**
```bash
npm install
node test-supabase.js
```

Expected output:
```
✅ All database tables are accessible!
✅ Database schema is properly configured.
```

---

## 🔄 Migration: Existing Plaintext Passwords

If you have **existing users with plaintext passwords** in the database, you need to migrate them:

### **Option 1: Force Password Reset (Recommended)**
1. Invalidate all existing sessions
2. Require users to reset passwords on next login
3. New passwords will be bcrypt hashed automatically

### **Option 2: Background Migration Script**
```javascript
// migrate-passwords.js
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('./src/lib/supabase');

async function migratePasswords() {
    // Get all users
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, email, password');

    for (const user of users) {
        // Check if password is already hashed (bcrypt hashes start with $2a$ or $2b$)
        if (!user.password.startsWith('$2')) {
            // Hash the plaintext password
            const hashedPassword = await bcrypt.hash(user.password, 10);

            // Update in database
            await supabaseAdmin
                .from('users')
                .update({ password: hashedPassword })
                .eq('id', user.id);

            console.log(`✅ Migrated password for: ${user.email}`);
        }
    }

    console.log('✅ All passwords migrated!');
}

migratePasswords();
```

**⚠️ IMPORTANT**: This script should only be run ONCE during migration!

---

## 🧪 Testing Database Operations

### **Test User Creation**
```javascript
// Create user with bcrypt password
const bcrypt = require('bcryptjs');
const hashedPassword = await bcrypt.hash('testpassword123', 10);

const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
        email: 'test@example.com',
        password: hashedPassword
    });
```

### **Test User Login**
```javascript
// Verify password
const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', 'test@example.com')
    .single();

const isValid = await bcrypt.compare('testpassword123', user.password);
console.log('Login valid:', isValid); // true
```

---

## 📊 Database Performance

### **Indexes Applied**
- ✅ Email index (users table)
- ✅ User ID index (agents table)
- ✅ Agent ID indexes (knowledge bases, sessions)
- ✅ Trigram indexes (document chunks for fuzzy search)
- ✅ Keyword GIN indexes (document chunks)

### **Expected Query Performance**
- User lookup by email: < 10ms
- Agent list for user: < 20ms
- RAG knowledge retrieval: < 50ms
- Session history: < 30ms

---

## 🔍 Monitoring & Debugging

### **Check Database Connection**
```bash
node test-supabase.js
```

### **View Database Logs**
1. Go to Supabase Dashboard
2. Click **Database** → **Logs**
3. Filter by error level

### **Check RLS Policies**
```sql
-- View all policies
SELECT * FROM pg_policies WHERE tablename = 'users';
```

### **Test RLS**
```sql
-- Should return only current user's data
SELECT * FROM agents WHERE user_id = auth.uid();
```

---

## 🆘 Troubleshooting

### **"Invalid input syntax for type uuid"**
**Cause**: Trying to insert invalid UUID format
**Fix**: Always use `uuid_generate_v4()` or validate UUID format

### **"Row Level Security policy violation"**
**Cause**: Trying to access data without proper authentication
**Fix**: Use `supabaseAdmin` for server-side operations

### **"Password authentication failed"**
**Cause**: bcrypt comparison failing
**Fix**: Ensure password field contains bcrypt hash, not plaintext

### **"Connection timeout"**
**Cause**: Network issues or wrong credentials
**Fix**: Verify `NEXT_PUBLIC_SUPABASE_URL` and API keys

---

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Indexes](https://supabase.com/docs/guides/database/indexes)

---

## ✅ Checklist

- [x] Supabase project created
- [x] SQL schema files applied
- [x] Environment variables configured
- [x] Database connection tested
- [x] Users table ready for bcrypt passwords
- [x] RLS policies enabled
- [x] Indexes created
- [x] Service role key configured

**Status**: ✅ **Production Ready**

---

**Last Updated**: 2026-01-23
**Schema Version**: 2.0
**Next Review**: After first production deployment
