# Paperfuse

> Daily curated AI research papers with AI-powered summaries and engineering insights

Paperfuse automatically fetches new papers from ArXiv, filters them through a smart system, and provides AI-generated summaries with practical engineering insights.

## ✨ Features

### Smart Paper Curation
- **Three-tier filtering** - Rules → Quick scoring → Deep analysis
- **Focus areas** - Reinforcement Learning, LLMs, Inference & Systems
- **AI scoring** - Papers rated 1-10 based on novelty and impact

### Rich Paper Analysis
- **AI summaries** - 3-5 sentence overviews
- **Key insights** - Main contributions extracted
- **Engineering notes** - Practical applications and framework tips
- **Code availability indicators** - See which papers have released code
- **Search & filter** - Find papers by topic, date, score, or keywords

### Flexible Deployment
- **Local mode** - No database required (JSON storage)
- **Supabase mode** - Cloud database for production
- **Static export ready** - Generate static sites from local data
- **Multiple LLM providers** - GLM (free tier) or Claude

## 🚀 Quick Start

### Option 1: Local Development (Recommended)

No database setup required!

```bash
# 1. Clone and install
git clone <your-repo-url>
cd paperfuse
npm install

# 2. Configure environment
cat > .env.local << EOF
# Use GLM (ZhipuAI) - has free tier
LLM_PROVIDER=glm
ZHIPUAI_API_KEY=your_api_key_here
EOF

# 3. Fetch and analyze papers
# Fetch 10 papers from last 3 days
curl http://localhost:3000/api/fetch-papers?maxPapers=10

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Get API key:** [open.bigmodel.cn](https://open.bigmodel.cn/)

### Option 2: Supabase + Production

```bash
# 1. Set up Supabase
# - Create project at supabase.com
# - Run SQL from supabase/migrations/001_initial_schema.sql
# - Copy credentials: Project URL, anon key, service_role key

# 2. Configure environment
cat > .env.local << EOF
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...

# LLM Provider
LLM_PROVIDER=glm
ZHIPUAI_API_KEY=your_api_key_here
EOF

# 3. Run
npm run dev
```

## 📖 Usage

### Fetching Papers Manually

```bash
# Basic fetch (10 papers, last 3 days)
GET /api/fetch-papers?maxPapers=10

# Fetch from last 7 days
GET /api/fetch-papers?maxPapers=20&daysBack=7

# Force re-analyze existing papers
GET /api/fetch-papers?maxPapers=10&forceReanalyze=true

# Use higher token limit for detailed analysis
GET /api/fetch-papers?maxPapers=5&maxTokens=16000
```

### Syncing Local Data to Supabase

Perfect workflow for static site generation:

```bash
# 1. Fetch papers locally (stored in local/data.json)
curl http://localhost:3000/api/fetch-papers?maxPapers=20&daysBack=7

# 2. Sync to Supabase for production
curl -X POST http://localhost:3000/api/sync-to-supabase

# 3. Or deploy static site
npm run build
```

### Using the Web Interface

- **Search** - Find papers by title, author, or keywords
- **Filter by topic** - RL, LLM, or Inference papers
- **Date range** - Last 7 days, 30 days, or all time
- **Sort by** - Latest first or highest score
- **View details** - Click any paper for full analysis including formulas, algorithms, and flow diagrams

## 🏗️ Development

### Project Structure

```
paperfuse/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── fetch-papers/  # Manual paper fetching
│   │   ├── analyze/       # Unified analysis endpoint
│   │   ├── papers/        # Paper queries
│   │   └── sync-to-supabase/ # Local to Supabase sync
│   ├── papers/[id]/       # Paper detail page
│   └── page.tsx           # Home page
├── components/            # React components
├── lib/                   # Core logic
│   ├── arxiv/            # ArXiv API
│   ├── llm/              # LLM abstraction
│   ├── filters/          # Three-tier filtering
│   └── db/               # Database (local + Supabase)
└── docs/
    └── api.md            # Full API documentation
```

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run seed       # Seed sample data
```

### Customization

Edit `lib/db/types.ts` to configure:

```typescript
const DOMAIN_CONFIGS: Record<PaperTag, DomainConfig> = {
  llm: {
    arxivCategories: ['cs.AI', 'cs.CL', 'cs.LG'],
    maxPapersPerDay: 10,        // Papers to fetch
    deepAnalysisCount: 3,       // Papers for deep analysis
    quickScoreThreshold: 7,     // Min score for deep analysis
    keywords: ['language model', 'llm', 'transformer'],
  },
  // ... more configs
};
```

## 🚢 Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect Vercel**
   - Import from GitHub
   - Add environment variables:
     - `LLM_PROVIDER=glm`
     - `ZHIPUAI_API_KEY`
     - Optional: Supabase credentials

3. **Deploy**
   - Vercel automatically builds and deploys
   - Cron job runs daily at 2 AM UTC

### Static Export

Generate a static site from local data:

```bash
# 1. Fetch papers locally
curl http://localhost:3000/api/fetch-papers?maxPapers=50&daysBack=30

# 2. Build static site
npm run build

# 3. Serve static files
npm run start
```

## 💰 Cost Estimates

### Using GLM (ZhipuAI) - Recommended

| Component | Daily | Monthly |
|-----------|-------|---------|
| Quick scoring (30 papers) | ¥0.30 | ¥9 |
| Deep analysis (8 papers) | ¥0.40 | ¥12 |
| **Total** | **~¥0.70** | **~¥21** |

GLM-4.5-Flash is **free** for quick scoring!

### Cost Optimization Tips

1. Use GLM instead of Claude (10x cheaper)
2. Adjust `quickScoreThreshold` to reduce deep analysis
3. Limit `daysBack` to fetch fewer papers
4. Use `skipAnalysis=true` for testing

## 📚 Documentation

- **[API Documentation](docs/api.md)** - Complete API reference
- **[Database Schema](supabase/migrations/001_initial_schema.sql)** - Supabase setup

## 🤝 Contributing

Contributions welcome! Areas of interest:
- Additional LLM providers
- Enhanced filtering rules
- UI improvements
- More analysis features

## 📄 License

MIT

## 🙏 Acknowledgments

- [ArXiv](https://arxiv.org/) - Open access research
- [ZhipuAI](https://open.bigmodel.cn/) - GLM models
- [Anthropic](https://www.anthropic.com/) - Claude API
- [Supabase](https://supabase.com/) - Database platform
- [Vercel](https://vercel.com/) - Hosting & Cron
- [shadcn](https://ui.shadcn.com/) - UI components
