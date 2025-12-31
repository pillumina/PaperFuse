# PaperFuse

Automated pipeline for fetching, filtering, and analyzing ArXiv papers.

## Scope

- Reinforcement Learning (RL)
- Large Language Models (LLM)
- Inference & Systems

## Quick Start

```bash
# Install
npm install

# Configure (get API key from open.bigmodel.cn)
cat > .env.local << EOF
LLM_PROVIDER=glm
ZHIPUAI_API_KEY=your_api_key_here
EOF

# Fetch and analyze 10 papers
curl "http://localhost:3000/api/fetch-papers?maxPapers=10"

# Start server
npm run dev
```

Open http://localhost:3000

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `LLM_PROVIDER` | `glm` (ZhipuAI) or `claude` |
| `ZHIPUAI_API_KEY` | Get from [open.bigmodel.cn](https://open.bigmodel.cn/) |
| `ANTHROPIC_API_KEY` | Required if using Claude |

### Optional: Supabase (for production)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...
```

Run `supabase/migrations/001_initial_schema.sql` to set up tables.

## Usage

### Fetch Papers

```bash
# Basic: 10 papers from last 3 days
/api/fetch-papers?maxPapers=10

# More papers, longer time range
/api/fetch-papers?maxPapers=20&daysBack=7

# Re-analyze existing papers
/api/fetch-papers?maxPapers=10&forceReanalyze=true
```

### Analysis Depth

```
depth=basic    # Abstract only (fastest)
depth=standard # Intro + conclusion → full text if score >= 8
depth=full     # Full text with detailed output
```

Default: `standard`

### Web Interface

- Search by title, author, keywords
- Filter by topic (RL, LLM, Inference)
- Sort by date or score
- Click paper for full analysis (formulas, algorithms, diagrams)

## How It Works

1. **Fetch** - Downloads papers from ArXiv categories (cs.AI, cs.LG, cs.CL)
2. **Filter** - Removes obvious mismatches via rules
3. **Score** - AI rates each paper 1-10 based on novelty and impact
4. **Analyze** - High-scoring papers get deep analysis with:
   - AI summary
   - Key insights
   - Engineering notes
   - Code links
   - Formulas and algorithms
   - Flow diagrams

## Deployment

### Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy (cron runs daily at 2 AM UTC)

### Static Export

```bash
# Fetch papers locally
curl "http://localhost:3000/api/fetch-papers?maxPapers=50&daysBack=30"

# Build static site
npm run build
npm run start
```

## Project Structure

```
paperfuse/
├── app/
│   ├── api/
│   │   ├── fetch-papers/    # Fetch and analyze
│   │   ├── analyze/          # Unified analysis endpoint
│   │   └── papers/           # Paper queries
│   └── papers/[id]/          # Detail page
├── lib/
│   ├── arxiv/               # ArXiv API
│   ├── llm/                 # LLM abstraction
│   ├── filters/             # Rule filtering
│   └── db/                  # Local JSON + Supabase
└── components/
```

## Cost

Using GLM-4.7 (ZhipuAI):
- ~30 papers/day: ~¥0.70/day (~¥21/month)
- GLM-4.5-Flash is free for quick scoring

## License

MIT
