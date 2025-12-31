/**
 * LaTeX Content Parser
 * Cleans and processes LaTeX content for LLM analysis
 */

import type { AnalysisDepth } from '@/lib/config/paper-analysis';

/**
 * Clean LaTeX content by removing unnecessary commands and noise
 */
export function cleanLatexContent(tex: string): string {
  let cleaned = tex;

  // Remove comments
  cleaned = cleaned.replace(/%.*$/gm, '');

  // Remove common LaTeX commands that don't add semantic value
  cleaned = cleaned.replace(/\\newcommand\{[^}]+\}\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/\\DeclareMathOperator\{[^}]+\}\{[^}]*\}/g, '');

  // Replace citations with [CITATION]
  cleaned = cleaned.replace(/\\cite\{[^}]+\}/g, '[CITATION]');
  cleaned = cleaned.replace(/\\citep?\{[^}]+\}/g, '[CITATION]');
  cleaned = cleaned.replace(/\\citep?\[[^]]*\]\{[^}]+\}/g, '[CITATION]');
  cleaned = cleaned.replace(/\\nocite\{[^}]+\}/g, '');

  // Replace references with [REF]
  cleaned = cleaned.replace(/\\ref\{[^}]+\}/g, '[REF]');
  cleaned = cleaned.replace(/\\eqref\{[^}]+\}/g, '[EQ]');
  cleaned = cleaned.replace(/\\cref\{[^}]+\}/g, '[REF]');

  // Remove figure placeholders
  cleaned = cleaned.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, '[FIGURE]');
  cleaned = cleaned.replace(/\\begin\{figure\*\}[\s\S]*?\\end\{figure\*\}/g, '[FIGURE]');

  // Remove table environments (keep content)
  cleaned = cleaned.replace(/\\begin\{table\}/g, '[TABLE]\n');
  cleaned = cleaned.replace(/\\end\{table\}/g, '\n[END TABLE]');
  cleaned = cleaned.replace(/\\begin\{table\*\}/g, '[TABLE]\n');
  cleaned = cleaned.replace(/\\end\{table\*\}/g, '\n[END TABLE]');

  // Remove \begin{document} and \end{document}
  cleaned = cleaned.replace(/\\begin\{document\}/g, '');
  cleaned = cleaned.replace(/\\end\{document\}/g, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract main sections from LaTeX content
 * For FULL mode: returns all cleaned content (not just sections)
 */
export function extractMainSections(tex: string): string {
  const cleaned = cleanLatexContent(tex);
  console.log(`[LatexParser] extractMainSections (FULL mode): cleaned content length = ${cleaned.length}`);

  // For FULL mode, return the entire cleaned content (will be truncated later if needed)
  // This gives the model access to everything: intro, methods, experiments, results, conclusion, etc.
  return cleaned;
}

/**
 * Extract Introduction and Conclusion sections only
 * Used for standard depth analysis (two-phase approach)
 */
export function extractIntroAndConclusion(tex: string): string {
  const cleaned = cleanLatexContent(tex);
  const sections: string[] = [];

  // Extract Introduction - try multiple patterns
  const introPatterns = [
    /\\section\{Introduction\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
    /\\section\{\s*1\.?\s*Introduction\s*\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
    /\\section\{\s*I\.?\s*Introduction\s*\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
    // Some papers use \section{1. Introduction}
    /\\section\{[\d\.]+\s*Introduction\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
  ];

  for (const pattern of introPatterns) {
    const introMatch = cleaned.match(pattern);
    if (introMatch) {
      sections.push(introMatch[0]);
      console.log(`[LatexParser] Found Introduction with pattern, length: ${introMatch[0].length}`);
      break;
    }
  }

  // Extract Conclusion (various possible names)
  const conclPatterns = [
    /\\section\{Conclusion\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
    /\\section\{Conclusions\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
    /\\section\{Concluding Remarks\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
    /\\section\{Discussion and Conclusion\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
    /\\section\{\s*\d+\.?\s*Conclusion[s]?\s*\}[\s\S]*?(?=\\section\{|\\bibliography|$)/i,
  ];

  for (const pattern of conclPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      sections.push(match[0]);
      console.log(`[LatexParser] Found Conclusion with pattern, length: ${match[0].length}`);
      break;  // Only take the first conclusion section
    }
  }

  // If no sections found, return a truncated portion of the beginning
  if (sections.length === 0) {
    console.log(`[LatexParser] No Introduction/Conclusion sections found, extracting first portion...`);
    // Extract first ~3000 chars as fallback
    const fallbackLength = Math.min(3000, cleaned.length);
    const fallback = cleaned.substring(0, fallbackLength);
    console.log(`[LatexParser] Fallback: extracted ${fallbackLength} chars from beginning`);
    return fallback + '\n\n[Note: Could not find Introduction/Conclusion sections, using paper beginning]';
  }

  console.log(`[LatexParser] Extracted ${sections.length} sections, total length: ${sections.join('\n\n---\n\n').length}`);
  return sections.join('\n\n---\n\n');
}

/**
 * Extract content based on analysis depth
 * - basic: returns empty string (abstract comes from ArXiv API)
 * - standard: returns intro + conclusion
 * - full: returns all main sections
 */
export function extractContentByDepth(tex: string, depth: AnalysisDepth): string {
  switch (depth) {
    case 'basic':
      return '';  // No LaTeX needed for basic mode
    case 'standard':
      return extractIntroAndConclusion(tex);
    case 'full':
      return extractMainSections(tex);
  }
}

/**
 * Truncate content to a maximum length while preserving sentence boundaries
 */
export function truncateToLength(content: string, maxLength: number = 50000): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to truncate at a sentence boundary
  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');

  if (lastPeriod > maxLength * 0.8) {
    return truncated.substring(0, lastPeriod + 1) + '\n\n[Content truncated...]';
  }

  return truncated + '\n\n[Content truncated...]';
}

/**
 * Convert LaTeX content to plain text while preserving math formulas
 */
export function latexToPlainText(tex: string): string {
  let text = tex;

  // Preserve inline math: \( ... \) or $ ... $
  text = text.replace(/\\\(([^)]+)\\\)/g, '[$1]');
  text = text.replace(/\$([^$]+)\$/g, '[$1]');

  // Preserve display math: \[ ... \] or $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n[MATH BLOCK]\n$1\n[END MATH]\n');
  text = text.replace(/\$\$([^$]+)\$\$/g, '\n[MATH BLOCK]\n$1\n[END MATH]\n');

  // Preserve equation environments
  text = text.replace(/\\begin\{equation\}[\s\S]*?\\end\{equation\}/g, '[EQUATION]');
  text = text.replace(/\\begin\{align\}[\s\S]*?\\end\{align\}/g, '[ALIGNMENT]');

  // Preserve code listings
  text = text.replace(/\\begin\{lstlisting\}[\s\S]*?\\end\{lstlisting\}/g, '[CODE]');
  text = text.replace(/\\begin\{verbatim\}[\s\S]*?\\end\{verbatim\}/g, '[CODE]');

  // Remove remaining LaTeX commands but keep content
  text = text.replace(/\\[a-zA-Z]+(\[.*?\])?\{([^}]*)\}/g, '$2');

  // Clean up braces
  text = text.replace(/[{ }]/g, ' ');

  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.trim();

  return text;
}
