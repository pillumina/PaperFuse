# Paperfuse MVP 实施计划

## 项目概述
创建一个每日 ArXiv 论文分析平台，专注于 RL、LLM、推理加速领域，为科研人员和工业界开发者提供论文摘要、关键亮点和工程落地建议。

## 技术栈
- Frontend: Next.js 14 (App Router) + shadcn/ui + Tailwind CSS
- Database: Supabase (PostgreSQL + pgvector)
- LLM: Claude API (Haiku 过滤 → Sonnet 深度分析)
- Tasks: Vercel Cron

---

## Phase 1: 数据库设计 (1天)

### 1.1 Supabase 表结构设计

创建以下表：

**`papers` 表** - 论文主表
```sql
id (uuid, pk)
arxiv_id (text, unique) -- 如 "2312.12345"
title (text)
authors (text[])
summary (text) -- 原始摘要
ai_summary (text) -- AI 生成的简洁摘要
key_insights (text[]) -- 关键亮点
engineering_notes (text) -- 工程落地建议
code_links (text[]) -- GitHub 等代码链接
tags (text[]) -- 标签: ["rl", "llm", "inference"]
published_date (date)
arxiv_url (text)
pdf_url (text)
filter_score (integer) -- 快速评分 1-10
is_deep_analyzed (boolean)
created_at (timestamp)
updated_at (timestamp)
```

**`paper_analysis_jobs` 表** - 分析任务跟踪
```sql
id (uuid, pk)
paper_id (uuid, fk papers)
status (enum: pending, filtering, analyzing, completed, failed)
job_type (enum: quick_score, deep_analysis)
error_message (text)
created_at (timestamp)
completed_at (timestamp)
```

**`daily_summaries` 表** - 每日汇总
```sql
id (uuid, pk)
date (date, unique)
domain (text) -- "rl", "llm", "inference"
total_fetched (integer)
papers_passed_filter (integer)
papers_deep_analyzed (integer)
top_paper_ids (uuid[])
created_at (timestamp)
```

### 1.2 设置 Supabase
- 创建 Supabase 项目
- 执行表结构 SQL
- 配置 RLS (Row Level Security)
- 创建必要的索引

---

## Phase 2: ArXiv 抓取器 (2天)

### 2.1 ArXiv API 集成
**文件**: `lib/arxiv.ts`

功能：
- `fetchPapersByCategory(category: string, days: number)` - 按分类抓取
- `parseArxivXML(xml: string)` - 解析 ArXiv 返回的 XML
- 支持的分类: cs.AI, cs.LG, stat.ML

### 2.2 标签映射系统
**文件**: `lib/tags.ts`

将 ArXiv 分类映射到我们的标签：
```typescript
const CATEGORY_TO_TAGS = {
  'cs.AI': ['llm', 'rl'],
  'cs.LG': ['llm', 'inference'],
  'stat.ML': ['rl', 'llm'],
  // ...
}
```

### 2.3 去重逻辑
- 检查 arxiv_id 是否已存在
- 标题相似度检测 (防止同一工作不同版本)

---

## Phase 3: 三级过滤系统 (2天)

### 3.1 Level 1: 规则预过滤
**文件**: `lib/filters/rule-filter.ts`

过滤规则：
- 标题黑名单词: "workshop", "note", "preliminary"
- 作者数: 1-50 人（过滤垃圾）
- 论文长度: > 3 页
- 顶会识别: NeurIPS, ICML, ICLR, ACL 优先

### 3.2 Level 2: 快速评分
**文件**: `lib/filters/quick-scorer.ts`

使用 Claude Haiku 快速评分：
```
输入: 标题 + 摘要
输出: 1-10 分 + 一句话理由
成本: ~$0.01/篇
```

配置配额：
```typescript
const DOMAIN_QUOTAS = {
  'rl': { maxPapers: 10, deepAnalysis: 3, threshold: 7 },
  'llm': { maxPapers: 10, deepAnalysis: 3, threshold: 7 },
  'inference': { maxPapers: 8, deepAnalysis: 2, threshold: 8 },
}
```

### 3.3 Level 3: 深度分析
**文件**: `lib/filters/deep-analyzer.ts`

使用 Claude Sonnet 深度分析：
- 完整论文摘要（3-5句话）
- 关键亮点（3-5条）
- 工程落地建议（推荐框架/Feature）
- 代码可用性评估

---

## Phase 4: API Routes (1天)

### 4.1 论文相关 API

**`GET /api/papers`** - 获取论文列表
查询参数: tag, date, limit, offset

**`GET /api/papers/[id]`** - 获取论文详情

**`POST /api/papers/[id]/request-analysis`** - 用户请求深度分析

### 4.2 Cron Job API

**`GET /api/cron/fetch-daily`** - Vercel Cron 调用
- 触发每日抓取
- 每天凌晨 2 点执行

---

## Phase 5: 前端界面 (3天)

### 5.1 基础 UI 组件
**文件**: `components/ui/*`

使用 shadcn/ui 创建：
- Button, Card, Badge, Dialog
- (使用 `npx shadcn-ui@latest add [component]`)

### 5.2 论文列表页
**文件**: `app/page.tsx`

功能：
- 标签筛选按钮
- 论文卡片列表
- 每张卡片显示：标题、作者、AI摘要、分数、标签
- 点击查看详情

### 5.3 论文详情页
**文件**: `app/papers/[id]/page.tsx`

功能：
- 完整标题、作者、发表时间
- AI 摘要
- 关键亮点 (bullet list)
- 工程落地建议
- 代码链接（如果有）
- 返回列表按钮

### 5.4 标签页面
**文件**: `app/tag/[tag]/page.tsx`

特定标签的论文列表

---

## Phase 6: 定时任务 (1天)

### 6.1 Vercel Cron 配置
**文件**: `vercel.json`

```json
{
  "crons": [{
    "path": "/api/cron/fetch-daily",
    "schedule": "0 2 * * *"
  }]
}
```

### 6.2 错误处理和监控
- 失败重试机制
- 错误日志记录
- 可选：简单邮件通知

---

## 实施顺序

### Week 1
1. ✅ 初始化 Next.js 项目
2. ⬜ 设计并创建 Supabase 表结构
3. ⬜ 实现 ArXiv 抓取器
4. ⬜ 实现规则预过滤

### Week 2
5. ⬜ 实现快速评分 (Claude Haiku)
6. ⬜ 实现深度分析 (Claude Sonnet)
7. ⬜ 创建基础 UI 组件
8. ⬜ 实现论文列表页

### Week 3
9. ⬜ 实现论文详情页
10. ⬜ 设置 Vercel Cron
11. ⬜ 测试完整流程
12. ⬜ 部署上线

---

## 关键决策点 (需要确认)

1. **初期领域**: 先做 RL + LLM + Inference 三个标签？
2. **LLM 选择**: 使用 Claude 还是 OpenAI？（Claude 便宜且质量好）
3. **部署**: Vercel 部署？
4. **数据库名称**: Supabase 项目命名 "paperfuse"？

---

## 成本预估

每天处理：
- 抓取: ~100 篇论文
- 快速评分: ~30 篇 × $0.01 = $0.30
- 深度分析: ~8 篇 × $0.20 = $1.60

**月成本**: ~$60 LLM API + Supabase 免费层 + Vercel 免费层
