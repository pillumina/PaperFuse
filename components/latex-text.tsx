'use client';

import { useMemo } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface LatexTextProps {
  text: string;
  className?: string;
}

/**
 * Render text that may contain inline LaTeX formulas
 * Supports \(...\) and $...$ for inline math
 */
export function LatexText({ text, className = '' }: LatexTextProps) {
  const parts = useMemo(() => {
    const result: Array<{ type: 'text' | 'latex'; content: string }> = [];
    let lastIndex = 0;

    // Match both \(...\) and $...$ patterns
    // Need to handle them carefully to avoid conflicts
    let i = 0;
    while (i < text.length) {
      // Check for \( start
      if (text.startsWith('\\(', i)) {
        // Find closing \)
        const endIdx = text.indexOf('\\)', i + 2);
        if (endIdx !== -1) {
          // Add text before this match
          if (i > lastIndex) {
            result.push({
              type: 'text',
              content: text.slice(lastIndex, i),
            });
          }
          // Add the LaTeX content (without \( and \))
          result.push({
            type: 'latex',
            content: text.slice(i + 2, endIdx),
          });
          lastIndex = endIdx + 2;
          i = lastIndex;
          continue;
        }
      }

      // Check for $ start (but not $$ which is display math)
      if (text.charAt(i) === '$' && text.charAt(i + 1) !== '$') {
        // Find closing $
        const endIdx = text.indexOf('$', i + 1);
        if (endIdx !== -1) {
          // Add text before this match
          if (i > lastIndex) {
            result.push({
              type: 'text',
              content: text.slice(lastIndex, i),
            });
          }
          // Add the LaTeX content (without the $ delimiters)
          result.push({
            type: 'latex',
            content: text.slice(i + 1, endIdx),
          });
          lastIndex = endIdx + 1;
          i = lastIndex;
          continue;
        }
      }

      i++;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    // If no LaTeX found, return all as text
    if (result.length === 0) {
      return [{ type: 'text', content: text }];
    }

    return result;
  }, [text]);

  // If no LaTeX patterns found, render as plain text
  if (parts.length === 1 && parts[0].type === 'text') {
    return <span className={className}>{parts[0].content}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'latex') {
          return (
            <InlineMath
              key={index}
              math={part.content}
              errorColor="#cc0000"
              renderError={(error) => {
                console.error('LaTeX inline error:', error);
                return <span className="text-destructive">\\({part.content}\\)</span>;
              }}
            />
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
}
