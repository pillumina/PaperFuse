import Link from 'next/link';
import { memo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PaperTag, PaperListItem, AnalysisDepth } from '@/lib/db/types';
import { ExternalLink, FileText, Wrench, Info, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';

const TAG_COLORS: Record<PaperTag, string> = {
  rl: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  llm: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  inference: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const TAG_LABELS: Record<PaperTag, string> = {
  rl: 'RL',
  llm: 'LLM',
  inference: 'Inference',
};

interface PaperCardProps {
  paper: PaperListItem;
  onNavigate?: () => void;
  index?: number;
}

function truncateReason(reason: string, maxLength = 100): string {
  if (reason.length <= maxLength) return reason;
  return reason.substring(0, maxLength) + '...';
}

function PaperCardComponent({ paper, onNavigate, index = 0 }: PaperCardProps) {
  const router = useRouter();
  const isNotAnalyzed = paper.analysis_type === 'none';
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const detailUrl = `/papers/${paper.id}`;

  // Prefetch detail page on hover
  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      router.prefetch(detailUrl);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.98 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Card className={`h-full hover:shadow-lg transition-shadow ${isNotAnalyzed ? 'border-dashed border-muted-foreground/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg line-clamp-2 leading-tight" title={paper.title}>
              <Link
                href={`/papers/${paper.id}`}
                className="hover:text-primary transition-colors"
                title={paper.title}
                onClick={onNavigate}
              >
                {paper.title}
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {paper.authors_short} · {paper.published_date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Show score when analyzed */}
            {!isNotAnalyzed && paper.filter_score && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className={getScoreColor(paper.filter_score)}>
                  {paper.filter_score}
                </span>
                <span className="text-muted-foreground">/10</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      {paper.filter_reason
                        ? truncateReason(paper.filter_reason)
                        : "AI score based on: novelty, technical quality, practical impact, and engineering relevance"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Show tags - when not analyzed, they're ArXiv categories */}
          {paper.tags.map((tag) => {
            // When not analyzed, show ArXiv categories as gray badges
            if (isNotAnalyzed) {
              return (
                <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">
                  {tag}
                </Badge>
              );
            }
            // When analyzed, use colored badges for PaperTags
            return (
              <Badge key={tag} variant="secondary" className={TAG_COLORS[tag as PaperTag]}>
                {TAG_LABELS[tag as PaperTag]}
              </Badge>
            );
          })}
          {paper.is_deep_analyzed && (
            <Badge variant="outline" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Deep Analysis
            </Badge>
          )}
          {paper.code_links && paper.code_links.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help border-green-200 text-green-700 dark:border-green-900 dark:text-green-400">
                  <Code2 className="w-3 h-3 mr-1" />
                  Code Available
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">This paper has code and resources available</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Show summary or AI summary */}
        {isNotAnalyzed ? (
          // When not analyzed, show original summary
          paper.summary ? (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-3" title={paper.summary}>
              {paper.summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic mb-3">
              No abstract available
            </p>
          )
        ) : paper.ai_summary ? (
          // When analyzed, show AI summary
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3" title={paper.ai_summary}>
            {paper.ai_summary}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic mb-3">
            Analysis in progress...
          </p>
        )}

        {/* Only show engineering notes when analyzed */}
        {!isNotAnalyzed && paper.engineering_notes_preview && (
          <div
            className="bg-muted/50 rounded-md p-2 flex items-start gap-2"
            title={paper.engineering_notes || undefined}
          >
            <Wrench className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground line-clamp-2">
              {paper.engineering_notes_preview}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex items-center gap-2">
          <Link
            href={`https://arxiv.org/abs/${paper.arxiv_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm" className="h-8">
              <ExternalLink className="w-4 h-4 mr-1" />
              arXiv
            </Button>
          </Link>
          <Link
            href={`/papers/${paper.id}`}
            onClick={onNavigate}
          >
            <Button variant="ghost" size="sm" className="h-8">
              Details
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
      </motion.div>
    </TooltipProvider>
  );
}

// Memoize PaperCard to prevent unnecessary re-renders
export const PaperCard = memo(PaperCardComponent);

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-yellow-600';
  return 'text-muted-foreground';
}
