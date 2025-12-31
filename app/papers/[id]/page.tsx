'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PaperTag, PaperDetailResponse } from '@/lib/db/types';
import { ArrowLeft, ExternalLink, FileText, Github, AlertCircle, Sigma, Boxes, Info, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import { LatexRenderer } from '@/components/latex-renderer';
import { LatexText } from '@/components/latex-text';

const TAG_COLORS: Record<PaperTag, string> = {
  rl: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  llm: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  inference: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const TAG_LABELS: Record<PaperTag, string> = {
  rl: 'Reinforcement Learning',
  llm: 'Large Language Model',
  inference: 'Inference & Systems',
};

// Dynamic import for Mermaid to avoid SSR issues
const MermaidDiagram = dynamic(
  () => import('@/components/mermaid-diagram').then(mod => ({ default: mod.MermaidDiagram })),
  { ssr: false }
);

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [paper, setPaper] = useState<PaperDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mermaidRenderSuccess, setMermaidRenderSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (params.id) {
      loadPaper(params.id as string);
    }
  }, [params.id]);

  async function loadPaper(id: string) {
    setLoading(true);
    setError(null);
    setMermaidRenderSuccess(null);  // Reset mermaid render state

    try {
      const response = await fetch(`/api/papers/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Paper not found');
        }
        throw new Error('Failed to load paper');
      }

      const data = await response.json();
      setPaper(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading paper...</p>
        </div>
      </main>
    );
  }

  if (error || !paper) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Link href="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Papers
            </Button>
          </Link>
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-xl font-semibold mb-2">Error</h2>
                  <p className="text-muted-foreground">{error || 'Paper not found'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <TooltipProvider>
        <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Papers
            </Button>
          </Link>

          <h1 className="text-3xl font-bold leading-tight mb-4">{paper.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            <span>{paper.authors.join(', ')}</span>
            <span>·</span>
            <span>{paper.published_date}</span>
            {paper.filter_score && (
              <>
                <span>·</span>
                <span className="font-semibold flex items-center gap-1.5">
                  Score: {paper.filter_score}/10
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">AI score based on: novelty, technical quality, practical impact, and engineering relevance</p>
                    </TooltipContent>
                  </Tooltip>
                </span>
              </>
            )}
          </div>

          {paper.filter_reason && (
            <div className="bg-muted/50 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{paper.filter_reason}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {paper.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className={TAG_COLORS[tag]}>
                {TAG_LABELS[tag]}
              </Badge>
            ))}
            {paper.analysis_type === 'full' && (
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
                <FileText className="w-3 h-3 mr-1" />
                Full Analysis
              </Badge>
            )}
            {paper.analysis_type === 'standard' && (
              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                <FileText className="w-3 h-3 mr-1" />
                Standard Analysis
              </Badge>
            )}
            {paper.analysis_type === 'basic' && (
              <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20">
                <FileText className="w-3 h-3 mr-1" />
                Basic Analysis
              </Badge>
            )}
          </div>

          {/* Disclaimer for basic/standard analysis (no full text) */}
          {(paper.analysis_type === 'basic' || paper.analysis_type === 'standard') && paper.is_deep_analyzed && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-medium">
                    {paper.analysis_type === 'basic' ? '基于摘要分析' : '基于部分内容分析'}
                  </span>
                  <span className="text-amber-700 dark:text-amber-300 ml-1">
                    {paper.analysis_type === 'basic'
                      ? '— AI 内容仅基于论文摘要生成，可能存在不准确之处，仅供参考'
                      : '— AI 内容基于论文摘要和部分章节（引言和结论）生成，详细信息可能不完整'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href={paper.arxiv_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                arXiv
              </Button>
            </Link>
            <Link href={paper.pdf_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </Link>
          </div>
        </div>

        {/* Content Sections - Accordion */}
        <Accordion type="multiple" defaultValue={["ai-summary", "insights", "engineering", "code", "formulas", "algorithms", "flow-diagram"]} className="w-full">
          {/* AI Summary - always show if available */}
          {paper.ai_summary && (
            <AccordionItem value="ai-summary" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold">AI Summary</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <p className="text-muted-foreground leading-relaxed">
                  {paper.ai_summary}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Original Abstract */}
          {paper.summary && (
            <AccordionItem value="abstract" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold">Original Abstract</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {paper.summary}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Key Insights - only for full analysis */}
          {paper.analysis_type === 'full' && paper.key_insights && paper.key_insights.length > 0 && (
            <AccordionItem value="insights" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold">Key Insights</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <ul className="space-y-3">
                  {paper.key_insights.map((insight, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{insight}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Engineering Notes */}
          {paper.engineering_notes && (
            <AccordionItem value="engineering" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  Engineering Notes
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {paper.engineering_notes}
                  </ReactMarkdown>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Code Links */}
          {paper.code_links && paper.code_links.length > 0 && (
            <AccordionItem value="code" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold">Code & Resources</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <ul className="space-y-2">
                  {paper.code_links.map((link, index) => (
                    <li key={index}>
                      <Link
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <Github className="w-4 h-4" />
                        {link}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Key Formulas - only for full analysis */}
          {paper.analysis_type === 'full' && paper.key_formulas && paper.key_formulas.length > 0 && (
            <AccordionItem value="formulas" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold flex items-center gap-2">
                  <Sigma className="w-5 h-5" />
                  Key Formulas
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <div className="space-y-4">
                  {paper.key_formulas.map((formula, index) => (
                    <div key={index} className="border-b border-border/50 pb-4 last:border-0">
                      <h4 className="font-semibold text-sm mb-2">{formula.name}</h4>
                      <LatexRenderer latex={formula.latex} />
                      <div className="text-sm text-muted-foreground mt-2">
                        <LatexText text={formula.description} />
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Algorithms - only for full analysis */}
          {paper.analysis_type === 'full' && paper.algorithms && paper.algorithms.length > 0 && (
            <AccordionItem value="algorithms" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold flex items-center gap-2">
                  <Boxes className="w-5 h-5" />
                  Key Algorithms
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <div className="space-y-4">
                  {paper.algorithms.map((algo, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-muted/30">
                      <h4 className="font-semibold text-lg mb-2">{algo.name}</h4>
                      {algo.complexity && (
                        <div className="mb-3">
                          <Badge variant="secondary" className="text-xs">
                            Complexity: {algo.complexity}
                          </Badge>
                        </div>
                      )}
                      <ol className="space-y-3 text-sm text-muted-foreground">
                        {algo.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                              {stepIndex + 1}
                            </span>
                            <LatexText text={step} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Flow Diagram - only for full analysis, and only if mermaid renders successfully */}
          {paper.analysis_type === 'full' && paper.flow_diagram && paper.flow_diagram.content &&
           (paper.flow_diagram.format !== 'mermaid' || mermaidRenderSuccess !== false) && (
            <AccordionItem value="flow-diagram" className="mb-4 border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="text-lg font-semibold flex items-center gap-2">
                  <Boxes className="w-5 h-5" />
                  {paper.flow_diagram.format === 'mermaid' ? 'Flow Diagram' : 'Method Overview'}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                {paper.flow_diagram.format === 'mermaid' ? (
                  <MermaidDiagram
                    chart={paper.flow_diagram.content}
                    onRenderChange={(success) => setMermaidRenderSuccess(success)}
                  />
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {paper.flow_diagram.content}
                    </ReactMarkdown>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
        </div>
      </TooltipProvider>
    </main>
  );
}
