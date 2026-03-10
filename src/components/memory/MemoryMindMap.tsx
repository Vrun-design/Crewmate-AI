import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import type { MemoryNode } from '../../types';

// Canvas API cannot read CSS variables, so we define the brand color here as a constant.
// If the brand color changes, update this value AND index.css --primary.
const BRAND_COLOR = '#E95420';

interface MemoryMindMapProps {
  nodes: MemoryNode[];
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphNode {
  group: MemoryNode['type'] | 'core';
  id: string;
  name: string;
  val: number;
  x?: number;
  y?: number;
}

export function MemoryMindMap({ nodes }: MemoryMindMapProps): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const isGraphSupported = useMemo(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return false;
    }

    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('2d'));
  }, []);

  useEffect(() => {
    if (!isGraphSupported) {
      return;
    }

    const observeTarget = containerRef.current;
    if (!observeTarget) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(observeTarget);
    return () => resizeObserver.disconnect();
  }, [isGraphSupported]);

  const graphData = useMemo(() => {
    const gNodes: GraphNode[] = [{ id: 'core', name: 'Memory Core', group: 'core', val: 5 }];
    const gLinks: GraphLink[] = [];

    nodes.forEach((node) => {
      const weight = parseFloat(node.tokens) || 1;

      gNodes.push({
        id: node.id,
        name: node.title,
        group: node.type,
        val: Math.max(2, Math.min(weight * 2, 8))
      });
      gLinks.push({
        source: 'core',
        target: node.id
      });
    });

    return { nodes: gNodes, links: gLinks };
  }, [nodes]);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-150);
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);
    }
  }, [graphData]);

  function getColor(group: GraphNode['group']): string {
    switch (group) {
      case 'core': return BRAND_COLOR;
      case 'document': return '#3b82f6';
      case 'integration': return '#8b5cf6';
      case 'preference': return '#10b981';
      default: return '#6b7280';
    }
  }

  return (
    <div className="flex-1 relative bg-secondary/50 overflow-hidden min-h-[500px] w-full rounded-xl" ref={containerRef}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {isGraphSupported ? (
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={(node) => getColor((node as GraphNode).group)}
          linkColor={() => 'rgba(128, 128, 128, 0.2)'}
          linkWidth={1.5}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const graphNode = node as GraphNode;
            const x = graphNode.x ?? 0;
            const y = graphNode.y ?? 0;
            const label = graphNode.name;
            const fontSize = 12 / globalScale;
            const r = Math.sqrt(Math.max(0, graphNode.val || 1)) * 3;

            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = getColor(graphNode.group);
            ctx.fill();

            if (graphNode.id === 'core') {
              ctx.shadowColor = BRAND_COLOR;
              ctx.shadowBlur = 15;
              ctx.fill();
              ctx.shadowBlur = 0;
            }

            if (globalScale > 1.2 && graphNode.id !== 'core') {
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.fillText(label, x, y + r + fontSize + 2);
            }
          }}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      ) : (
        <div className="relative z-10 grid gap-3 p-6 sm:grid-cols-2">
          {nodes.map((node) => (
            <div key={node.id} className="rounded-xl border border-border bg-background/80 px-4 py-3 shadow-sm">
              <div className="text-sm font-medium text-foreground">{node.title}</div>
              <div className="mt-1 text-xs text-muted-foreground capitalize">{node.type}</div>
            </div>
          ))}
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex gap-3 z-10 px-3 py-2 glass-panel rounded-lg shadow-sm border border-border">
        {(['document', 'preference', 'integration', 'core'] as const).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(type) }}></div>
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
