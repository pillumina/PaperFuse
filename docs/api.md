# Paperfuse API Documentation

Complete API reference for Paperfuse.

---

## Table of Contents

- [Analysis APIs](#analysis-apis)
  - [POST /api/analyze](#post-apianalyze)
- [Fetch & Process APIs](#fetch--process-apis)
  - [GET /api/fetch-papers](#get-apifetch-papers)
  - [POST /api/sync-to-supabase](#post-apisync-to-supabase)
- [Paper Query APIs](#paper-query-apis)
  - [GET /api/papers](#get-apipapers)
  - [GET /api/papers/[id]](#get-apipapersid)
- [Cron APIs](#cron-apis)
  - [GET /api/cron/fetch-daily](#get-apicronfetch-daily)

---

## Analysis APIs

### POST /api/analyze

**Unified paper analysis** - Single API call for classification, scoring, and deep analysis.

#### Request

```json
POST /api/analyze
Content-Type: application/json

{
  "title": "Scaling Laws for Language Models",
  "summary": "We study the scaling properties of language models...",
  "categories": ["cs.AI", "cs.LG"],
  "fullText": "...",           // Optional: full paper text
  "skipDeepAnalysis": false,    // Optional: skip deep analysis
  "maxTokens": 12000            // Optional: override max tokens
}
```

#### Response

```json
{
  "tags": ["llm", "inference"],
  "confidence": "high",
  "reasoning": "Paper discusses inference optimization...",
  "score": 8,
  "scoreReason": "Novel approach with significant practical impact",
  "deepAnalysis": {
    "ai_summary": "3-5 sentence summary...",
    "key_insights": ["insight 1", "insight 2", "insight 3"],
    "engineering_notes": "Practical applications...",
    "code_links": ["https://github.com/..."],
    "key_formulas": [...],
    "algorithms": [...],
    "flow_diagram": {...}
  }
}
```

---

## Fetch & Process APIs

### GET /api/fetch-papers

**Fetch and analyze papers from ArXiv** - Main endpoint for manual paper fetching.

#### Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `maxPapers` | number | 10 | 30 | Maximum papers to process |
| `daysBack` | number | 3 | - | How many days back to fetch from ArXiv |
| `skipAnalysis` | boolean | false | - | Skip deep analysis (save tokens) |
| `clear` | boolean | false | - | Clear existing data before fetching |
| `forceReanalyze` | boolean | false | - | Force re-analysis of existing papers |
| `maxTokens` | number | 12000 | - | Override default max tokens for LLM |

#### Examples

```bash
# Fetch and analyze 10 papers from last 3 days
GET /api/fetch-papers?maxPapers=10

# Fetch 20 papers from last 7 days
GET /api/fetch-papers?maxPapers=20&daysBack=7

# Only classify, skip deep analysis (save tokens)
GET /api/fetch-papers?maxPapers=20&skipAnalysis=true

# Clear existing data and fetch fresh
GET /api/fetch-papers?maxPapers=5&clear=true

# Force re-analyze existing papers
GET /api/fetch-papers?maxPapers=10&forceReanalyze=true

# Use higher token limit for more detailed analysis
GET /api/fetch-papers?maxPapers=5&maxTokens=16000
```

#### Response

```json
{
  "success": true,
  "duration_seconds": 45,
  "total_fetched": 40,
  "passed_filter": 15,
  "analyzed": 10,
  "deep_analyzed": 8,
  "stored": 10,
  "skipped_already_analyzed": 2,
  "by_tag": {
    "rl": 2,
    "llm": 5,
    "inference": 3
  },
  "by_score": {
    "high": 6,
    "medium": 3,
    "low": 1
  }
}
```

#### Flow

1. Fetch from ArXiv (using `ARXIV_CATEGORIES` env var)
2. Apply rule-based filter
3. Check existing papers (skip already deep analyzed unless `forceReanalyze=true`)
4. Call `/api/analyze` for each new paper
5. Store to local JSON or Supabase

---

### POST /api/sync-to-supabase

**Sync local papers to Supabase** - Transfer data from local storage to Supabase.

Use case: Fetch papers locally, analyze them, then sync to Supabase for production.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `clear` | boolean | false | Clear Supabase data before syncing |

#### Examples

```bash
# Sync local data to Supabase (preserving existing data)
POST /api/sync-to-supabase

# Clear Supabase first, then sync
POST /api/sync-to-supabase?clear=true
```

#### Response

```json
{
  "success": true,
  "duration_seconds": 5,
  "synced": 42,
  "skipped": 0,
  "errors": [],
  "message": "Synced 42 papers to Supabase"
}
```

---

## Paper Query APIs

### GET /api/papers

**Get papers list** with filtering, search, and pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tag` | string | null | Filter by tag: "rl" \| "llm" \| "inference" |
| `search` | string | null | Search in title, authors, AI summary |
| `dateFrom` | string | null | Filter by date (YYYY-MM-DD) |
| `dateTo` | string | null | Filter by date (YYYY-MM-DD) |
| `sortBy` | string | "date" | Sort by: "date" \| "score" |
| `minScore` | number | null | Minimum filter score (1-10) |
| `deepAnalyzedOnly` | boolean | false | Only show deep analyzed papers |
| `limit` | number | 20 | Results per page |
| `offset` | number | 0 | Pagination offset |

#### Examples

```bash
# Get recent papers from last 7 days
GET /api/papers?dateFrom=2025-01-01

# Search for papers about "reinforcement learning"
GET /api/papers?search=reinforcement%20learning

# Get high-score LLM papers, sorted by score
GET /api/papers?tag=llm&minScore=8&sortBy=score

# Get deep analyzed inference papers
GET /api/papers?tag=inference&deepAnalyzedOnly=true

# Pagination
GET /api/papers?limit=10&offset=20
```

#### Response

```json
{
  "papers": [
    {
      "id": "1234567890",
      "arxiv_id": "2401.12345",
      "title": "Paper Title",
      "authors": ["Author 1", "Author 2"],
      "authors_short": "Author 1 et al.",
      "ai_summary": "Summary...",
      "engineering_notes_preview": "Practical applications...",
      "filter_reason": "Novel approach with practical impact",
      "code_links": ["https://github.com/..."],
      "tags": ["llm", "inference"],
      "published_date": "2025-01-15",
      "filter_score": 8,
      "is_deep_analyzed": true
    }
  ],
  "total": 42,
  "has_more": true
}
```

---

### GET /api/papers/[id]

**Get paper details** by ID.

#### Response

```json
{
  "id": "1234567890",
  "arxiv_id": "2401.12345",
  "title": "Paper Title",
  "authors": ["Author 1", "Author 2"],
  "summary": "Abstract...",
  "ai_summary": "AI-generated summary...",
  "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
  "engineering_notes": "Practical applications...",
  "code_links": ["https://github.com/..."],
  "key_formulas": [
    {
      "latex": "\\theta_{t+1} = \\theta_t - \\alpha \\nabla loss",
      "name": "Gradient Descent",
      "description": "Standard optimization rule"
    }
  ],
  "algorithms": [
    {
      "name": "PPO",
      "steps": ["step 1", "step 2"],
      "complexity": "O(n)"
    }
  ],
  "flow_diagram": {
    "format": "mermaid",
    "content": "graph TD; A-->B; B-->C"
  },
  "tags": ["llm", "inference"],
  "published_date": "2025-01-15",
  "arxiv_url": "https://arxiv.org/abs/2401.12345",
  "pdf_url": "https://arxiv.org/pdf/2401.12345.pdf",
  "filter_score": 8,
  "filter_reason": "Novel approach with practical impact",
  "is_deep_analyzed": true,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

---

## Cron APIs

### GET /api/cron/fetch-daily

**Daily cron job** - Automatically fetch and analyze papers (called by Vercel Cron).

Protected by `CRON_SECRET` environment variable.

#### Request Headers

```
Authorization: Bearer YOUR_CRON_SECRET
```

#### Response

```json
{
  "success": true,
  "duration_seconds": 120,
  "date": "2025-01-15",
  "total_processed": 30,
  "total_stored": 25,
  "tags": {
    "rl": { "fetched": 10, "filtered": 8, "deep_analyzed": 2 },
    "llm": { "fetched": 12, "filtered": 10, "deep_analyzed": 3 },
    "inference": { "fetched": 8, "filtered": 7, "deep_analyzed": 2 }
  }
}
```

---

## Environment Variables

```bash
# LLM Provider (required)
LLM_PROVIDER=glm  # Options: glm, claude

# GLM (ZhipuAI) - if LLM_PROVIDER=glm
ZHIPUAI_API_KEY=your_key
GLM_QUICK_MODEL=glm-4.5-flash  # Free tier
GLM_DEEP_MODEL=glm-4.7          # Flagship

# Claude (Anthropic) - if LLM_PROVIDER=claude
ANTHROPIC_API_KEY=your_key
CLAUDE_QUICK_MODEL=claude-haiku
CLAUDE_DEEP_MODEL=claude-sonnet

# ArXiv Configuration
ARXIV_CATEGORIES=cs.AI,cs.LG,stat.ML

# Supabase (optional - if not set, uses local JSON storage)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...

# Cron Protection
CRON_SECRET=your_random_secret_string
```

---

## Error Responses

All APIs return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (missing/invalid parameters)
- `401` - Unauthorized (missing/invalid cron secret)
- `500` - Server error (LLM API error, parse error, etc.)

---

## Rate Limits & Token Usage

| Operation | Token Usage (approx) | Cost (GLM) |
|-----------|---------------------|------------|
| Quick classification | ~300 | FREE |
| Full analysis | ~2000 | ~0.003 RMB |
| Deep analysis | ~12000 | ~0.018 RMB |

**Optimization Tips:**
1. Already deep analyzed papers are automatically skipped
2. Use `skipAnalysis=true` for quick exploration
3. Use `maxTokens` to control output length
4. Adjust `daysBack` to limit fetch scope

---

## Storage Modes

Paperfuse supports two storage modes:

### Local Mode (Default)
- Stores data in `local/data.json`
- No database setup required
- Perfect for development and testing
- Enabled when Supabase env vars are not set

### Supabase Mode
- Stores data in Supabase PostgreSQL
- Persistent cloud storage
- Requires Supabase setup
- Enabled when Supabase env vars are set
