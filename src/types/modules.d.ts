declare module 'react-force-graph-2d' {
  import { Component } from 'react';

  interface ForceGraph2DProps {
    graphData?: { nodes: any[]; links: any[] };
    nodeLabel?: string | ((node: any) => string);
    nodeColor?: string | ((node: any) => string);
    nodeRelSize?: number;
    nodeVal?: string | number | ((node: any) => number);
    nodeCanvasObject?: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    nodePointerAreaPaint?: (node: any, color: string, ctx: CanvasRenderingContext2D) => void;
    linkColor?: string | ((link: any) => string);
    linkWidth?: number | ((link: any) => number);
    linkOpacity?: number;
    backgroundColor?: string;
    onNodeClick?: (node: any, event: MouseEvent) => void;
    onNodeHover?: (node: any | null, previousNode: any | null) => void;
    warmupTicks?: number;
    cooldownTicks?: number;
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    width?: number;
    height?: number;
    ref?: any;
    [key: string]: any;
  }

  const ForceGraph2D: React.ForwardRefExoticComponent<ForceGraph2DProps & React.RefAttributes<any>>;
  export default ForceGraph2D;
}

declare module 'unpdf' {
  export function extractText(data: Uint8Array, options?: { mergePages?: boolean }): Promise<{ text: string; totalPages: number }>;
  export function getDocumentProxy(data: Uint8Array): Promise<any>;
  export function getMeta(data: Uint8Array): Promise<any>;
}
