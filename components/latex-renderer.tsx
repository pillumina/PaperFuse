'use client';

import { useMemo } from 'react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  latex: string;
  fallback?: string;
}

export function LatexRenderer({ latex, fallback }: LatexRendererProps) {
  // Clean up the latex string - remove common escape issues
  const cleanedLatex = useMemo(() => {
    let cleaned = latex;

    // Remove excessive backslashes (LLM sometimes outputs \\ instead of \)
    cleaned = cleaned.replace(/\\\\+/g, '\\');

    // Handle display math markers \[...\]
    if (cleaned.startsWith('\\[') && cleaned.endsWith('\\]')) {
      cleaned = cleaned.slice(2, -2);
    }
    // Handle inline math markers \(...\)
    if (cleaned.startsWith('\\(') && cleaned.endsWith('\\)')) {
      cleaned = cleaned.slice(2, -2);
    }

    return cleaned.trim();
  }, [latex]);

  return (
    <div className="latex-formula flex items-center justify-center py-2 overflow-x-auto">
      <BlockMath
        math={cleanedLatex}
        errorColor="#cc0000"
        renderError={(error) => {
          console.error('LaTeX render error:', error);
          return (
            <div className="text-sm text-muted-foreground bg-destructive/10 p-2 rounded">
              <span className="font-mono text-xs">{cleanedLatex}</span>
              <p className="text-xs text-destructive mt-1">LaTeX rendering error</p>
            </div>
          );
        }}
      />
    </div>
  );
}
