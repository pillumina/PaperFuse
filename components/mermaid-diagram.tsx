'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

// Track initialization state globally
let mermaidInitialized = false;

export function MermaidDiagram({ chart, id = 'mermaid-chart' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

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

          // Render the diagram
          const { svg } = await mermaid.render(uniqueId, chart);
          containerRef.current.innerHTML = svg;
        } catch (error) {
          console.error('Mermaid render error:', error);
          if (containerRef.current) {
            containerRef.current.innerHTML = `<p class="text-sm text-muted-foreground">Failed to render diagram</p>`;
          }
        }
      }
    };

    renderDiagram();
  }, [chart, id, isReady]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center bg-muted/50 rounded-lg p-4 overflow-auto"
      style={{ minHeight: '100px' }}
    />
  );
}
