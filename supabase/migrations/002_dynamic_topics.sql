-- Migration: Change from ENUM to TEXT for dynamic topics support
-- This allows custom topics defined in TOPICS_CONFIG

-- Step 1: Add a new tags column as TEXT array
ALTER TABLE papers ADD COLUMN IF NOT EXISTS tags_new TEXT[] NOT NULL DEFAULT '{}';

-- Step 2: Migrate data from old tags column to new one
UPDATE papers SET tags_new = ARRAY[tags::text]::TEXT[] WHERE tags != '{}';

-- Step 3: Drop old constraints and column
ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_tags_check;
ALTER TABLE papers DROP COLUMN IF EXISTS tags;

-- Step 4: Rename new column
ALTER TABLE papers RENAME COLUMN tags_new TO tags;

-- Step 5: Update indexes (GIN index still works on TEXT[])
DROP INDEX IF EXISTS idx_papers_tags;
CREATE INDEX idx_papers_tags ON papers USING GIN(tags);

-- Step 6: Update daily_summaries table
ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS tag_new TEXT;
UPDATE daily_summaries SET tag_new = tag::text;
ALTER TABLE daily_summaries DROP CONSTRAINT IF EXISTS daily_summaries_tag_fkey;
ALTER TABLE daily_summaries DROP COLUMN IF EXISTS tag;
ALTER TABLE daily_summaries RENAME COLUMN tag_new TO tag;

-- Note: The get_papers_by_tag function is removed since the app uses
-- the database abstraction layer in lib/db/supabase.ts which handles
-- dynamic tag filtering using the ANY/ALL array operators.

-- Step 7: Update daily_summaries index (tag is now TEXT, not ENUM)
DROP INDEX IF EXISTS idx_daily_summaries_date_tag;
CREATE INDEX idx_daily_summaries_date_tag ON daily_summaries(summary_date DESC, tag);
