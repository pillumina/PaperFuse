# Supabase Database Setup Guide

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization (or create one)
4. Set project name: `paperfuse`
5. Set database password (save it!)
6. Choose region closest to you
7. Click "Create new project"

## Step 2: Get Environment Variables

After project is created, go to:

**Project Settings → API**

Copy these values:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## Step 3: Run Database Migration

### Option A: Using Supabase Dashboard (Recommended for MVP)

1. Go to **SQL Editor** in Supabase Dashboard
2. Click "New Query"
3. Copy contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click "Run" (or Cmd+Enter)
5. Verify all tables were created successfully

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migration
supabase db push
```

## Step 4: Configure Environment Variables

Create `.env.local` in project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Optional: ArXiv settings
ARXIV_CATEGORIES=cs.AI,cs.LG,stat.ML
```

## Step 5: Verify Setup

Check that tables exist in **Table Editor**:
- ✅ `papers`
- ✅ `paper_analysis_jobs`
- ✅ `daily_summaries`

## Database Schema Overview

### `papers` table
Main storage for all fetched papers.

Key fields:
- `arxiv_id` - Unique identifier from ArXiv
- `tags` - Enum array: ['rl', 'llm', 'inference']
- `filter_score` - 1-10 rating from quick analysis
- `is_deep_analyzed` - Whether full analysis was done

### `paper_analysis_jobs` table
Tracks analysis jobs for async processing.

### `daily_summaries` table
Daily aggregation stats per tag.

## Security Notes

⚠️ **Important**:
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - never commit to git
- The service key should only be used server-side (API routes)
- The anon key is safe for client-side use with RLS policies

For MVP, RLS policies allow public read access. In production, consider:
- Adding authentication (Supabase Auth)
- Restricting write operations
- Rate limiting

## Next Steps

After database setup:
1. Test connection with a simple API call
2. Run the ArXiv fetcher
3. Verify papers appear in database
4. Proceed to LLM analysis setup
