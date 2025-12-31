import { NextRequest, NextResponse } from 'next/server';
import { LLMProvider } from '@/lib/llm/types';
import { callGLM } from '@/lib/llm/glm-client';
import Anthropic from '@anthropic-ai/sdk';
import { getApiModelName } from '@/lib/llm/types';
import { PaperTag } from '@/lib/db/types';

/**
 * POST /api/analyze
 * Unified paper analysis: classification + scoring + deep analysis
 *
 * This replaces separate calls to classify, score, and deep analyze.
 * Much more efficient - single LLM call per paper.
 *
 * Request body:
 * {
 *   "title": string,
 *   "summary": string,
 *   "categories": string[],
 *   "fullText"?: string,  // Optional: full paper text for better analysis
 *   "skipDeepAnalysis"?: boolean,  // Skip deep analysis to save tokens (deprecated, use outputLevel)
 *   "outputLevel"?: "phase1" | "full",  // Control output detail: phase1 (basic only) or full (all fields)
 *   "minScoreThreshold"?: number,  // For full mode: threshold for detailed fields (algorithms/formulas/diagrams)
 *   "maxTokens"?: number  // Optional: override default max tokens (default: 2000 quick, 12000 deep)
 * }
 *
 * Response:
 * {
 *   "tags": PaperTag[],
 *   "confidence": "high" | "medium" | "low",
 *   "reasoning": string,
 *   "score": number,  // 1-10
 *   "scoreReason": string,
 *   "deepAnalysis"?: {  // Only if skipDeepAnalysis != true
 *     "ai_summary": string,
 *     "key_insights": string[],
 *     "engineering_notes": string,
 *     "code_links": string[]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Analyze] Received body:', JSON.stringify(body, null, 2));

    const {
      title,
      summary,
      categories = [],
      fullText,
      skipDeepAnalysis = false,
      outputLevel,
      minScoreThreshold,
      maxTokens: userMaxTokens
    } = body;

    // Determine output level: outputLevel takes priority, fallback to skipDeepAnalysis
    const effectiveOutputLevel = outputLevel || (skipDeepAnalysis ? 'phase1' : 'full');
    const isPhase1Only = effectiveOutputLevel === 'phase1';

    console.log(`[Analyze] Parsed fields - title: ${!!title}, summary: ${!!summary}, fullText: ${!!fullText}`);
    console.log(`[Analyze] title length: ${title?.length || 0}`);
    console.log(`[Analyze] summary length: ${summary?.length || 0}`);
    if (fullText) {
      console.log(`[Analyze] fullText length: ${fullText.length} (using full paper text)`);
    }

    if (!title || !summary) {
      console.log('[Analyze] FAILED VALIDATION - Missing required fields');
      return NextResponse.json(
        {
          error: 'Missing required fields: title, summary',
          received: { hasTitle: !!title, hasSummary: !!summary }
        },
        { status: 400 }
      );
    }

    console.log(`[Analyze] Analyzing paper: ${title.substring(0, 50)}...`);
    console.log(`[Analyze] Output level: ${effectiveOutputLevel} (${isPhase1Only ? 'phase1 only - basic output' : 'full - all details'})`);
    const startTime = Date.now();

    const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'glm';
    // Use deep model for all analyzes (more accurate scoring)
    const model = process.env.GLM_DEEP_MODEL || 'glm-4.7';

    // Use user-provided maxTokens or default (4000 phase1 with fullText, 12000 full)
    // Note: phase1 with fullText needs more tokens than abstract-only
    const defaultMaxTokens = isPhase1Only ? 4000 : 12000;
    const maxTokens = userMaxTokens && userMaxTokens > 0 ? userMaxTokens : defaultMaxTokens;

    console.log(`[Analyze] Model selection: outputLevel=${effectiveOutputLevel}, model=${model}`);
    console.log(`[Analyze] Using maxTokens: ${maxTokens} ${userMaxTokens ? '(user override)' : '(default)'}`);

    const thresholdForDetails = minScoreThreshold || 7;  // Default to 7 if not provided

    const systemPrompt = `You are an expert AI/ML research analyst. Your task is to analyze research papers and provide a comprehensive assessment.

# Part 1: Classification

Categorize the paper into these domains:
- **rl**: Reinforcement Learning - RL algorithms, policy optimization, value functions, actor-critic, PPO, DQN, exploration/exploitation, etc.
- **llm**: Large Language Models - architecture, training, alignment, capabilities, transformers, GPT, BERT, etc.
- **inference**: LLM Inference & Systems - optimization, quantization, serving, vLLM, TensorRT-LLM, deployment, etc.

Rules:
- A paper CAN belong to MULTIPLE domains (e.g., RLHF = llm + rl)
- At least one tag must be provided
- Set confidence based on how clearly the paper fits

# Part 2: Scoring

Rate the paper's value and significance from 1-10:
- **9-10**: Major breakthrough, novel approach, must-read
- **7-8**: Solid contribution, useful insights, worth following
- **5-6**: Incremental improvement, limited novelty
- **1-4**: Minor work, poor quality, or not significant

# Part 3: Deep Analysis${isPhase1Only ? ' (PHASE 1 - Basic Output Only)' : ''}

${!isPhase1Only ? `Extract structured information from the paper:

**ALWAYS OUTPUT THESE BASIC FIELDS:**
1. **ai_summary**: 3-5 sentence summary of the core contribution

2. **key_insights**: 3-5 bullet points of key takeaways

3. **engineering_notes**: Practical applications, frameworks that could benefit (e.g., PyTorch, vLLM, VERL)

4. **code_links**: GitHub repos or implementations mentioned
   - ONLY include ACTUAL, WORKING code links explicitly mentioned in the paper
   - Do NOT include: paper pages, arxiv links, or "coming soon" mentions
   - If no actual code is provided, return empty array []
   - Each link should be a direct GitHub repo or project URL

**ONLY OUTPUT THESE DETAILED FIELDS IF SCORE >= ${thresholdForDetails}:**
5. **key_formulas**: Array of important formulas. Each should have:
   - "latex": LaTeX format (use \\( inline \\) or \\[ display \\])
   - "name": Formula name
   - "description": Brief explanation

6. **algorithms**: Array of key algorithms. Each should have:
   - "name": Algorithm name
   - "steps": Array of step descriptions
   - "complexity": Time/space complexity if mentioned

7. **flow_diagram**: For framework/method papers, provide:
   - "format": "mermaid" or "text"
   - "content": Mermaid code OR step-by-step description

IMPORTANT: After scoring the paper, if the score is < ${thresholdForDetails}, set key_formulas=null, algorithms=null, flow_diagram=null (do not extract these fields).` : 'For phase 1, only provide: ai_summary (3-5 sentences) and engineering_notes (brief practical applications)'}

# Output Format

Respond ONLY with valid JSON (no markdown, no code blocks):

${isPhase1Only ? `
{
  "tags": ["rl","llm","inference"],
  "confidence": "high",
  "classification_reasoning": "Brief explanation",
  "score": 8,
  "score_reasoning": "Why this score",
  "deep_analysis": {
    "ai_summary": "3-5 sentence summary",
    "engineering_notes": "Brief practical applications"
  }
}
` : `
{
  "tags": ["llm","inference"],
  "confidence": "high",
  "classification_reasoning": "Paper discusses inference optimization",
  "score": 9,
  "score_reasoning": "Novel approach with significant practical impact",
  "deep_analysis": {
    "ai_summary": "3-5 sentence summary",
    "key_insights": ["insight 1", "insight 2", "insight 3"],
    "engineering_notes": "Practical applications and framework recommendations",
    "code_links": ["https://github.com/username/repo"],
    "key_formulas": [
      {
        "latex": "\\\\(L(\\\\theta) = \\\\sum_{i=1}^n \\\\log p_\\\\theta(y_i|x_i)\\\)",
        "name": "Loss Function",
        "description": "Cross-entropy loss"
      }
    ],
    "algorithms": [
      {
        "name": "PPO",
        "steps": ["Collect trajectories", "Compute advantages", "Update policy"],
        "complexity": "O(N)"
      }
    ],
    "flow_diagram": {
      "format": "mermaid",
      "content": "graph TD\\nA[Input] --> B[Model]\\nB --> C[Output]"
    }
  }
}

NOTE: If score < ${thresholdForDetails}, omit key_formulas, algorithms, and flow_diagram (set to null).
`}`;

    const userMessage = `Title: ${title}

Abstract: ${summary}

ArXiv Categories: ${categories.join(', ')}

${fullText ? `Full Paper Text:\n${fullText.substring(0, 150000)}${fullText.length > 150000 ? '\n\n[Text truncated due to length...]' : ''}` : ''}

Analyze this paper. Respond with ONLY a JSON object.`;

    console.log(`[Analyze] Calling LLM: provider=${provider}, model=${model}, maxTokens=${maxTokens}`);
    console.log(`[Analyze] User message length: ${userMessage.length} chars (fullText: ${fullText?.length || 0} chars)`);
    console.log(`[Analyze] System prompt length: ${systemPrompt.length} chars`);

    let response: string;

    if (provider === 'claude') {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const anthropicResponse = await anthropic.messages.create({
        model: getApiModelName('claude', model),
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = anthropicResponse.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }
      response = content.text;
    } else {
      const glmResponse = await callGLM(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        model,
        { temperature: 0.1, maxTokens: maxTokens }
      );
      response = glmResponse.content;
    }

    // Parse response
    const result = parseAnalysisResponse(response, categories);

    const duration = Date.now() - startTime;
    console.log(`[Analyze] Complete in ${duration}ms: tags=[${result.tags.join(',')}] score=${result.score} confidence=${result.confidence}`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Analyze] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Parse analysis response with JSON repair for truncated responses
 */
function parseAnalysisResponse(text: string, categories: string[]): any {
  const trimmedText = text.trim();
  let jsonText = trimmedText;

  // Extract JSON from response
  const jsonCodeBlockMatch = trimmedText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonCodeBlockMatch) {
    jsonText = jsonCodeBlockMatch[1].trim();
  } else {
    const firstBrace = trimmedText.indexOf('{');
    const lastBrace = trimmedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = trimmedText.substring(firstBrace, lastBrace + 1);
    }
  }

  // Try to parse directly first
  try {
    const parsed = JSON.parse(jsonText);
    console.log('[Analyze] Successfully parsed JSON');
    return buildResult(parsed);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Analyze] Failed to parse JSON:', errMsg);
    console.error('[Analyze] Attempted JSON length:', jsonText.length);

    // Try to repair truncated JSON
    try {
      const repaired = repairTruncatedJSON(jsonText);
      console.log('[Analyze] Successfully repaired truncated JSON');
      return buildResult(JSON.parse(repaired));
    } catch (repairError) {
      const repairErrMsg = repairError instanceof Error ? repairError.message : String(repairError);
      console.error('[Analyze] JSON repair also failed:', repairErrMsg);
      console.error('[Analyze] Raw response (first 500 chars):', trimmedText.substring(0, 500));

      // Final fallback - try to extract what we can
      return extractPartialData(jsonText, trimmedText);
    }
  }
}

/**
 * Repair truncated JSON by closing unclosed structures
 */
function repairTruncatedJSON(jsonStr: string): string {
  let repaired = jsonStr.trim();

  // Count brackets
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  // Close missing braces
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  // Close missing brackets
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }

  // Fix truncated strings (ending with unclosed quote)
  if (repaired.endsWith('"')) {
    repaired = repaired.slice(0, -1);
  }

  // Fix trailing comma in objects/arrays
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  // Fix incomplete keys (e.g., "score_reasoning": "partial)
  repaired = repaired.replace(/"([^"]+)":\s*"([^"]*)$/g, '"$1": "$2..."');

  return repaired;
}

/**
 * Validate code links - filter out invalid URLs
 */
function validateCodeLinks(links: any): string[] {
  if (!Array.isArray(links)) return [];

  return links.filter((link: string) => {
    if (typeof link !== 'string') return false;

    // Must be a valid URL
    try {
      const url = new URL(link);
      // Must be http or https
      if (!['http:', 'https:'].includes(url.protocol)) return false;

      // Filter out common non-code URLs
      const hostname = url.hostname.toLowerCase();
      const blockedDomains = [
        'arxiv.org',
        'arxiv.com',
        'scholar.google.com',
        'semanticscholar.org',
        'aclanthology.org',
        'openreview.net',
        'pmlr.press',
        'proceedings.mlr.press',
      ];

      if (blockedDomains.some(d => hostname.includes(d))) return false;

      // Filter out paper-like URLs (contain common patterns)
      const blockedPatterns = [
        '/pdf/',
        '/abs/',
        '/pdf/',
        'paper',
        'proceedings',
        'openreview',
      ];

      const linkLower = link.toLowerCase();
      if (blockedPatterns.some(p => linkLower.includes(p))) return false;

      // Prefer GitHub/GitLab/actual code hosting
      const validDomains = [
        'github.com',
        'gitlab.com',
        'huggingface.co',
        'bitbucket.org',
        'gitee.com',
        'gist.github.com',
      ];

      // If it's a valid domain (including the ones above), keep it
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Build result object from parsed JSON
 */
function buildResult(parsed: any): any {
  // Validate tags
  let tags: PaperTag[] = [];
  if (Array.isArray(parsed.tags)) {
    tags = parsed.tags.filter((t: string) => ['rl', 'llm', 'inference'].includes(t));
  }
  if (tags.length === 0) tags = ['llm'];

  // Validate confidence
  const validConfidences = ['high', 'medium', 'low'];
  const confidence = validConfidences.includes(parsed.confidence) ? parsed.confidence : 'medium';

  // Validate score
  const score = Math.min(10, Math.max(1, parsed.score || 5));

  // Extract deep analysis with new structured fields
  const rawDeepAnalysis = parsed.deep_analysis || parsed.deepAnalysis || null;
  let deepAnalysis: any = null;

  if (rawDeepAnalysis && typeof rawDeepAnalysis === 'object') {
    deepAnalysis = {
      ai_summary: rawDeepAnalysis.ai_summary || null,
      key_insights: Array.isArray(rawDeepAnalysis.key_insights) ? rawDeepAnalysis.key_insights : null,
      engineering_notes: rawDeepAnalysis.engineering_notes || null,
      code_links: validateCodeLinks(rawDeepAnalysis.code_links),
      // New structured fields
      key_formulas: Array.isArray(rawDeepAnalysis.key_formulas) ? rawDeepAnalysis.key_formulas : null,
      algorithms: Array.isArray(rawDeepAnalysis.algorithms) ? rawDeepAnalysis.algorithms : null,
      flow_diagram: rawDeepAnalysis.flow_diagram || null,
    };
  }

  return {
    tags,
    confidence,
    reasoning: parsed.classification_reasoning || parsed.reasoning || '',
    score,
    scoreReason: parsed.score_reasoning || parsed.score_reason || '',
    deepAnalysis,
  };
}

/**
 * Extract partial data when JSON parsing completely fails
 */
function extractPartialData(jsonText: string, fullText: string): any {
  console.log('[Analyze] Attempting to extract partial data...');

  // Try to extract score using regex
  const scoreMatch = fullText.match(/"score"\s*:\s*(\d+)/);
  const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]))) : 5;

  // Try to extract tags
  const tagsMatch = fullText.match(/"tags"\s*:\s*\[([^\]]*)\]/);
  let tags: PaperTag[] = ['llm'];
  if (tagsMatch) {
    const tagStr = tagsMatch[1];
    const possibleTags = tagStr.split(',').map((t: string) => t.trim().replace(/"/g, ''));
    tags = possibleTags.filter((t: string) => ['rl', 'llm', 'inference'].includes(t)) as PaperTag[];
  }
  if (tags.length === 0) tags = ['llm'];

  // Try to extract confidence
  const confidenceMatch = fullText.match(/"confidence"\s*:\s*"(\w+)"/);
  const validConfidences = ['high', 'medium', 'low'];
  const confidence = (confidenceMatch && validConfidences.includes(confidenceMatch[1])) ? confidenceMatch[1] : 'low';

  console.log('[Analyze] Extracted partial data:', { tags, score, confidence });

  return {
    tags,
    confidence,
    reasoning: 'JSON was truncated, extracted partial data',
    score,
    scoreReason: 'JSON was truncated, using extracted score',
    deepAnalysis: null,
  };
}

export const dynamic = 'force-dynamic';
