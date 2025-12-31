'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  id?: string;
  onRenderChange?: (success: boolean) => void;  // Callback to report render status
}

// Track initialization state globally
let mermaidInitialized = false;

export function MermaidDiagram({ chart, id = 'mermaid-chart', onRenderChange }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [renderSuccess, setRenderSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    // Initialize Mermaid once on client side
    if (typeof window !== 'undefined' && !mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });
      mermaidInitialized = true;
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || !containerRef.current) return;

    const renderDiagram = async () => {
      if (containerRef.current && typeof window !== 'undefined') {
        try {
          // Clear previous content
          containerRef.current.innerHTML = '';

          // Generate unique ID for this diagram
          const uniqueId = `${id}-${Math.random().toString(36).substr(2, 9)}`;

          // Validate the syntax first (mermaid.parse throws on invalid syntax)
          try {
            await mermaid.parse(chart);
          } catch (parseError) {
            // Parse error - invalid mermaid syntax
            console.warn('Mermaid parse error:', parseError);
            setRenderSuccess(false);
            onRenderChange?.(false);
            if (containerRef.current) {
              containerRef.current.innerHTML = '';
            }
            return;
          }

          // Render the diagram
          const { svg } = await mermaid.render(uniqueId, chart);
          containerRef.current.innerHTML = svg;
          setRenderSuccess(true);
          onRenderChange?.(true);
        } catch (error) {
          console.error('Mermaid render error:', error);
          setRenderSuccess(false);
          onRenderChange?.(false);
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
        }
      }
    };

    renderDiagram();
  }, [chart, id, isReady, onRenderChange]);

  // Don't render anything if failed (let parent hide the block)
  if (renderSuccess === false) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center bg-muted/50 rounded-lg p-4 overflow-auto"
      style={{ minHeight: '100px' }}
    />
  );
}
