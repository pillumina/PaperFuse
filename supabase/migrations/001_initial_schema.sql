-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- Tags enum type
-- ============================================
CREATE TYPE paper_tag AS ENUM ('rl', 'llm', 'inference');

-- ============================================
-- Papers table
-- ============================================
CREATE TABLE papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arxiv_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    authors TEXT[] NOT NULL,
    summary TEXT, -- Original abstract from arXiv
    ai_summary TEXT, -- AI-generated concise summary
    key_insights TEXT[], -- Key highlights/bullet points
    engineering_notes TEXT, -- Engineering/industry recommendations
    code_links TEXT[], -- GitHub, project links
    tags paper_tag[] NOT NULL DEFAULT '{}',
    published_date DATE NOT NULL,
    arxiv_url TEXT NOT NULL,
    pdf_url TEXT NOT NULL,
    filter_score INTEGER CHECK (filter_score >= 1 AND filter_score <= 10), -- Quick score 1-10
    filter_reason TEXT, -- Reason for the score
    is_deep_analyzed BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1, -- arXiv version (v1, v2, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Paper analysis jobs table
-- ============================================
CREATE TYPE job_status AS ENUM ('pending', 'filtering', 'analyzing', 'completed', 'failed');
CREATE TYPE job_type AS ENUM ('quick_score', 'deep_analysis');

CREATE TABLE paper_analysis_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    status job_status NOT NULL DEFAULT 'pending',
    job_type job_type NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- Daily summaries table
-- ============================================
CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    summary_date DATE NOT NULL,
    tag paper_tag NOT NULL,
    total_fetched INTEGER DEFAULT 0,
    papers_passed_filter INTEGER DEFAULT 0,
    papers_deep_analyzed INTEGER DEFAULT 0,
    top_paper_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(summary_date, tag)
);

-- ============================================
-- Indexes for performance
-- ============================================

-- Papers indexes
CREATE INDEX idx_papers_arxiv_id ON papers(arxiv_id);
CREATE INDEX idx_papers_published_date ON papers(published_date DESC);
CREATE INDEX idx_papers_tags ON papers USING GIN(tags);
CREATE INDEX idx_papers_filter_score ON papers(filter_score DESC);
CREATE INDEX idx_papers_is_deep_analyzed ON papers(is_deep_analyzed);
CREATE INDEX idx_papers_created_at ON papers(created_at DESC);

-- Full-text search on title and summary
CREATE INDEX idx_papers_title_search ON papers USING GIN(to_tsvector('english', title));
CREATE INDEX idx_papers_summary_search ON papers USING GIN(to_tsvector('english', summary));

-- Paper analysis jobs indexes
CREATE INDEX idx_jobs_paper_id ON paper_analysis_jobs(paper_id);
CREATE INDEX idx_jobs_status ON paper_analysis_jobs(status);
CREATE INDEX idx_jobs_created_at ON paper_analysis_jobs(created_at DESC);

-- Daily summaries indexes
CREATE INDEX idx_daily_summaries_date_tag ON daily_summaries(summary_date DESC, tag);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_papers_updated_at
    BEFORE UPDATE ON papers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- For MVP: Allow all reads (public API)
CREATE POLICY "Allow public read access on papers"
    ON papers FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on paper_analysis_jobs"
    ON paper_analysis_jobs FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on daily_summaries"
    ON daily_summaries FOR SELECT
    USING (true);

-- Allow service role to insert/update (used by API routes with service key)
CREATE POLICY "Allow service role insert on papers"
    ON papers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow service role update on papers"
    ON papers FOR UPDATE
    USING (true);

CREATE POLICY "Allow service role insert on paper_analysis_jobs"
    ON paper_analysis_jobs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow service role update on paper_analysis_jobs"
    ON paper_analysis_jobs FOR UPDATE
    USING (true);

CREATE POLICY "Allow service role insert on daily_summaries"
    ON daily_summaries FOR INSERT
    WITH CHECK (true);

-- ============================================
-- Helper functions
-- ============================================

-- Function to get papers by tag with pagination
CREATE OR REPLACE FUNCTION get_papers_by_tag(
    p_tag paper_tag,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    arxiv_id TEXT,
    title TEXT,
    authors TEXT[],
    ai_summary TEXT,
    tags paper_tag[],
    published_date DATE,
    filter_score INTEGER,
    is_deep_analyzed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.arxiv_id,
        p.title,
        p.authors,
        p.ai_summary,
        p.tags,
        p.published_date,
        p.filter_score,
        p.is_deep_analyzed
    FROM papers p
    WHERE p.tag = p_tag
    ORDER BY p.published_date DESC, p.filter_score DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to check if paper already exists (by arxiv_id or similar title)
CREATE OR REPLACE FUNCTION paper_exists(p_arxiv_id TEXT, p_title TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    exists_count INTEGER;
BEGIN
    -- Check exact match by arxiv_id
    IF EXISTS (SELECT 1 FROM papers WHERE arxiv_id = p_arxiv_id) THEN
        RETURN TRUE;
    END IF;

    -- Check for similar titles (handle version updates)
    SELECT COUNT(*) INTO exists_count
    FROM papers
    WHERE title = p_title AND arxiv_id LIKE p_arxiv_id || '%';

    RETURN exists_count > 0;
END;
$$ LANGUAGE plpgsql;
