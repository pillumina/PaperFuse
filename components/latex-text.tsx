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
 * Supports \(...\) for inline math
 */
export function LatexText({ text, className = '' }: LatexTextProps) {
  const parts = useMemo(() => {
    // Match \(...\) patterns for inline math (non-greedy to handle nested parentheses)
    const regex = /\\\(.*?\\\)/g;
    const result: Array<{ type: 'text' | 'latex'; content: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
        });
      }
      // Add the LaTeX content (strip the \( and \) delimiters)
      result.push({
        type: 'latex',
        content: match[0].slice(2, -2), // Remove \( and \)
      });
      lastIndex = regex.lastIndex;
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
