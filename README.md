# PaperFuse

Automated pipeline for fetching, filtering, and analyzing ArXiv papers with AI-powered insights.

## Features

- **Customizable Topics** - Define your own research topics via environment configuration
- **Smart Filtering** - AI-powered classification and scoring of papers
- **Deep Analysis** - Extracts key formulas, algorithms, and engineering insights
- **Visual Content** - Renders LaTeX formulas and Mermaid flow diagrams
- **Fast Search** - Search by title, author, keywords, or AI summary
- **Code Links** - Automatically finds GitHub repositories and code links

## Quick Start

```bash
# Install
npm install

# Configure (get API key from open.bigmodel.cn)
cat > .env.local << EOF
LLM_PROVIDER=glm
ZHIPUAI_API_KEY=your_api_key_here

# Optional: customize topics (JSON format)
TOPICS_CONFIG='[
  {"key":"rl","label":"Reinforcement Learning","description":"RL algorithms, training methods...","color":"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"},
  {"key":"llm","label":"Large Language Models","description":"LLM architecture, training...","color":"bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}
]'
EOF

# Fetch and analyze 10 papers
curl "http://localhost:3000/api/fetch-papers?maxPapers=10"

# Start server
npm run dev
```

Open http://localhost:3000

## Configuration

### Required

| Environment Variable | Description |
|---------------------|-------------|
| `LLM_PROVIDER` | `glm` (ZhipuAI) or `claude` |
| `ZHIPUAI_API_KEY` | Get from [open.bigmodel.cn](https://open.bigmodel.cn/) |
| `ANTHROPIC_API_KEY` | Required if using Claude |

### Optional - Topics Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `TOPICS_CONFIG` | JSON array defining custom research topics (see below) |

**Topics Configuration Format:**

```env
TOPICS_CONFIG='[
  {
    "key": "rl",
    "label": "Reinforcement Learning",
    "description": "RL algorithms, training methods, exploration, policy optimization...",
    "color": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
  },
  {
    "key": "llm",
    "label": "Large Language Models",
    "description": "LLM architecture, training, alignment, capabilities...",
    "color": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }
]'
```

- `key`: Unique identifier stored in database
- `label`: Display name shown in UI
- `description`: Detailed description for LLM classification
- `color`: Tailwind CSS classes for badge styling

### Optional - Analysis Settings

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `ARXIV_CATEGORIES` | cs.AI,cs.LG,stat.ML | ArXiv categories to fetch |
| `ENABLE_LLM_ANALYSIS` | false | Enable AI analysis |
| `ANALYSIS_DEPTH` | standard | basic, standard, or full |
| `MIN_SCORE_THRESHOLD` | 7 | Score threshold for detailed output |
| `MIN_SCORE_TO_SAVE` | 6 | Minimum score to save paper |
| `GLM_QUICK_MODEL` | glm-4.5-flash | Fast model for classification |
| `GLM_DEEP_MODEL` | glm-4.7 | Deep model for analysis |

### Optional - Supabase (Production)

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
curl "http://localhost:3000/api/fetch-papers?maxPapers=10"

# More papers, longer time range
curl "http://localhost:3000/api/fetch-papers?maxPapers=20&daysBack=7"

# Re-analyze existing papers
curl "http://localhost:3000/api/fetch-papers?maxPapers=10&forceReanalyze=true"
```

### Analysis Depth

- `basic` - Abstract only (fastest, no LaTeX download)
- `standard` - Intro + conclusion for scoring, full text if score >= threshold
- `full` - Full text with model deciding detailed output based on score

### Web Interface

- **Search** - By title, author, keywords
- **Filter** - By custom topics
- **Sort** - By date or AI score
- **Details** - Click paper for full analysis:
  - AI summary
  - Key insights
  - Engineering notes
  - Code links
  - Formulas (rendered LaTeX)
  - Algorithms
  - Flow diagrams

## How It Works

1. **Fetch** - Downloads papers from configured ArXiv categories
2. **Classify** - AI classifies into your custom topics
3. **Score** - AI rates each paper 1-10 based on novelty and impact
4. **Analyze** - High-scoring papers get deep analysis
5. **Visualize** - Renders formulas, algorithms, and diagrams

## Custom Topics

You can define your own research topics without any code changes:

1. Edit `TOPICS_CONFIG` in `.env.local`
2. Restart the server
3. New topics appear automatically in the UI

The LLM will classify papers into your custom topics based on the descriptions you provide.

## Deployment

### Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables (including `TOPICS_CONFIG`)
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
│   │   ├── topics/           # Get configured topics
│   │   └── papers/           # Paper queries
│   └── papers/[id]/          # Detail page
├── lib/
│   ├── arxiv/               # ArXiv API
│   ├── llm/                 # LLM abstraction
│   ├── topics.ts            # Topics configuration
│   ├── filters/             # Rule filtering
│   └── db/                  # Local JSON + Supabase
└── components/
    └── home-content.tsx     # Client-side home page
```

## Cost

Using GLM-4.7 (ZhipuAI):
- ~30 papers/day: ~¥0.70/day (~¥21/month)
- GLM-4.5-Flash is free for quick scoring

## License

MIT
