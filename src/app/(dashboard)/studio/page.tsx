'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  Link2,
  Zap,
  Tag,
  Loader2,
  Search,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ArrowRight,
  MessageSquare,
  FileText,
  HelpCircle,
  ExternalLink,
  Layers
} from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface">
      <div className="flex items-center gap-2 text-text-tertiary text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-slate-blue" />
        <span>Loading Knowledge Graph engine...</span>
      </div>
    </div>
  ),
});

interface GraphNode {
  id: string;
  label: string;
  type: string;
  strength: number;
  val?: number;
  color?: string;
  description?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number;
  _bridge?: boolean;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Muted, technical node colors communicating precise type semantics
const typeColors: Record<string, string> = {
  concept: '#3b82f6',     // Slate blue
  entity: '#8b5cf6',      // Violet
  document: '#10b981',    // Emerald
  idea: '#f59e0b',        // Amber
  person: '#6366f1',      // Indigo
  technology: '#06b6d4',  // Cyan/teal
  topic: '#ec4899',       // Rose
  diagram: '#38bdf8',     // Sky blue
  organization: '#14b8a6',// Teal
};

export default function StudioPage() {
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  
  // Graph Controls State
  const [filterType, setFilterType] = useState<string>('all');
  const [minStrength, setMinStrength] = useState<number>(0);
  const [labelDisplayMode, setLabelDisplayMode] = useState<'auto' | 'all' | 'none'>('auto');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGraphHelp, setShowGraphHelp] = useState(false);

  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGraphData();
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Configure gentle, readable D3 simulation forces
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-160).distanceMax(280);
      graphRef.current.d3Force('link')?.distance((link: any) => {
        if (link._bridge) return 180;
        const sourceType = typeof link.source === 'string' ? '' : link.source?.type;
        const targetType = typeof link.target === 'string' ? '' : link.target?.type;
        return sourceType === targetType ? 55 : 110;
      }).strength((link: any) => {
        return link._bridge ? 0.04 : 0.45;
      });
      graphRef.current.d3Force('center')?.strength(0.12);
    }
  }, [graphData]);

  // Handle live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHighlightedNodeId(null);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = graphData.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
    );
    setSearchResults(results);
  }, [searchQuery, graphData.nodes]);

  const focusOnNode = useCallback((node: GraphNode) => {
    setHighlightedNodeId(node.id);
    setSelectedNode(node);
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 700);
      graphRef.current.zoom(3.2, 700);
    }
  }, []);

  const fetchGraphData = async () => {
    try {
      const res = await fetch('/api/brain/graph');
      const data = await res.json();

      // Filter out internal study artifacts and any nodes with raw CUID/hash labels
      const isCuidOrHash = (str: string) => /^c[a-z0-9]{20,}$/i.test(str) || /^[0-9a-f-]{32,}$/i.test(str);

      const allNodes = (data.nodes || [])
        .filter((n: GraphNode) => {
          if (!n.label || typeof n.label !== 'string') return false;
          const trimmed = n.label.trim();
          if (!trimmed || isCuidOrHash(trimmed)) return false;
          if (n.type === 'study_artifact' || n.type?.startsWith('study_')) return false;
          return true;
        })
        .map((n: GraphNode) => ({
          ...n,
          val: Math.max((n.strength || 1) * 2.2, 3),
          color: typeColors[n.type?.toLowerCase()] || '#3b82f6',
        }));

      const MAX_TOTAL_NODES = 120;
      const importantNodes = allNodes.filter((n: GraphNode) => n.type !== 'entity');
      const entityNodes = allNodes
        .filter((n: GraphNode) => n.type === 'entity')
        .sort((a: GraphNode, b: GraphNode) => (b.strength || 1) - (a.strength || 1))
        .slice(0, Math.max(MAX_TOTAL_NODES - importantNodes.length, 30));
      const nodes = [...importantNodes, ...entityNodes];
      const nodeIds = new Set(nodes.map((n: GraphNode) => n.id));

      const allLinks: GraphLink[] = data.links || [];
      const linkCountPerNode = new Map<string, number>();
      const MAX_LINKS_PER_NODE = 7;

      const sortedLinks = [...allLinks].sort(
        (a: any, b: any) => (b.strength || 0) - (a.strength || 0)
      );

      const filteredLinks = sortedLinks.filter((link: any) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
        if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return false;
        if (sourceId === targetId) return false;
        const srcCount = linkCountPerNode.get(sourceId) || 0;
        const tgtCount = linkCountPerNode.get(targetId) || 0;
        if (srcCount >= MAX_LINKS_PER_NODE && tgtCount >= MAX_LINKS_PER_NODE) return false;
        linkCountPerNode.set(sourceId, srcCount + 1);
        linkCountPerNode.set(targetId, tgtCount + 1);
        return true;
      });

      // Bridge disconnected clusters for unified canvas stability
      const adjacency = new Map<string, Set<string>>();
      nodes.forEach((n: GraphNode) => adjacency.set(n.id, new Set()));
      filteredLinks.forEach((link: any) => {
        const s = typeof link.source === 'string' ? link.source : link.source?.id;
        const t = typeof link.target === 'string' ? link.target : link.target?.id;
        adjacency.get(s)?.add(t);
        adjacency.get(t)?.add(s);
      });

      const visited = new Set<string>();
      const clusters: string[][] = [];
      for (const node of nodes) {
        if (visited.has(node.id)) continue;
        const cluster: string[] = [];
        const queue = [node.id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);
          cluster.push(current);
          const neighbors = adjacency.get(current);
          if (neighbors) {
            for (const neighbor of Array.from(neighbors)) {
              if (!visited.has(neighbor)) queue.push(neighbor);
            }
          }
        }
        clusters.push(cluster);
      }

      if (clusters.length > 1) {
        clusters.sort((a, b) => b.length - a.length);
        const mainNodeId = clusters[0][0];
        for (let i = 1; i < clusters.length; i++) {
          filteredLinks.push({
            source: clusters[i][0],
            target: mainNodeId,
            strength: 0.08,
            _bridge: true,
          } as GraphLink);
        }
      }

      setGraphData({ nodes, links: filteredLinks });
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
      toast.error('Could not load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  // Find all nodes connected to selectedNode
  const connectedNodes = useMemo(() => {
    if (!selectedNode || !graphData.links.length) return [];
    const connectedIds = new Set<string>();
    for (const link of graphData.links) {
      const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
      if (sourceId === selectedNode.id) connectedIds.add(targetId);
      if (targetId === selectedNode.id) connectedIds.add(sourceId);
    }
    return graphData.nodes.filter((n) => connectedIds.has(n.id));
  }, [selectedNode, graphData]);

  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedNode) {
      ids.add(selectedNode.id);
      connectedNodes.forEach((n) => ids.add(n.id));
    }
    return ids;
  }, [selectedNode, connectedNodes]);

  const searchMatchIds = useMemo(() => {
    return new Set(searchResults.map((n) => n.id));
  }, [searchResults]);

  // Filtered graph view based on selected controls
  const visibleGraphData = useMemo(() => {
    if (filterType === 'all' && minStrength === 0) {
      return graphData;
    }

    const filteredNodes = graphData.nodes.filter((n) => {
      const matchType = filterType === 'all' || n.type.toLowerCase() === filterType.toLowerCase();
      const matchStrength = (n.strength || 1) >= minStrength;
      return matchType && matchStrength;
    });

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = graphData.links.filter((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    return { nodes: filteredNodes, links: filteredLinks };
  }, [graphData, filterType, minStrength]);

  const rebuildGraph = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/brain/graph', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Graph rebuilt: ${data.nodesCreated} concepts, ${data.connectionsCreated} relationships`);
        await fetchGraphData();
      } else {
        toast.error('Failed to rebuild graph');
      }
    } catch {
      toast.error('Failed to rebuild graph');
    } finally {
      setRebuilding(false);
    }
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    setHighlightedNodeId(node.id);
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 700);
      graphRef.current.zoom(3.2, 700);
    }
  }, []);

  const handleAskAboutNode = (node: GraphNode) => {
    const prompt = `Explain the concept "${node.label}" (${node.type}) and its relationship to connected concepts in my knowledge base.`;
    router.push(`/converse?docId=${node.id}&title=${encodeURIComponent(node.label)}`);
  };

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = node.val || 4;
      const color = node.color || '#3b82f6';
      const isSelected = selectedNode?.id === node.id;
      const isConnected = selectedNode && connectedNodeIds.has(node.id);
      const isDimmed = selectedNode && !connectedNodeIds.has(node.id);
      const isHighlighted = highlightedNodeId === node.id;
      const isSearchMatch = searchQuery && searchMatchIds.has(node.id);
      const isSearchDimmed = searchQuery && searchResults.length > 0 && !searchMatchIds.has(node.id);

      // Subtle outer aura
      ctx.beginPath();
      const glowSize = isHighlighted ? 10 : isSelected ? 8 : isConnected ? 5 : isSearchMatch ? 6 : 2;
      ctx.arc(node.x, node.y, size + glowSize, 0, 2 * Math.PI);
      if (isHighlighted) {
        ctx.fillStyle = color + '50';
      } else if (isSearchDimmed || isDimmed) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)';
      } else if (isSearchMatch) {
        ctx.fillStyle = color + '35';
      } else {
        ctx.fillStyle = color + (isSelected ? '40' : isConnected ? '25' : '10');
      }
      ctx.fill();

      // Highlight focus dashed ring
      if (isHighlighted || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = isHighlighted ? '#f59e0b' : color;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Search match ring
      if (isSearchMatch && !isSelected && !isHighlighted) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.2 / globalScale;
        ctx.stroke();
      }

      // Solid Node Body
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = (isSearchDimmed || isDimmed) ? color + '25' : color;
      ctx.fill();

      // Label logic
      let shouldShowLabel = false;
      if (labelDisplayMode === 'all') {
        shouldShowLabel = true;
      } else if (labelDisplayMode === 'none') {
        shouldShowLabel = isSelected || isHighlighted;
      } else {
        // Auto (Zoom-based LOD)
        shouldShowLabel = isSelected || isHighlighted || isSearchMatch || isConnected || globalScale > 1.7;
      }

      if (shouldShowLabel) {
        const fontSize = Math.max(
          (isSelected || isHighlighted) ? 12 / globalScale : isSearchMatch ? 11 / globalScale : 9.5 / globalScale,
          2.5
        );
        ctx.font = `${(isSelected || isHighlighted || isSearchMatch) ? '600 ' : '400 '}${fontSize}px Inter, -apple-system, sans-serif`;

        const labelText = node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label;
        const textWidth = ctx.measureText(labelText).width;
        const bgPadding = 2 / globalScale;
        const textY = node.y + size + 4;

        // Clean label background
        ctx.fillStyle = (isSearchDimmed || isDimmed)
          ? 'rgba(15, 23, 42, 0.4)'
          : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(
          node.x - textWidth / 2 - bgPadding,
          textY - fontSize / 2,
          textWidth + bgPadding * 2,
          fontSize + bgPadding
        );

        ctx.fillStyle = (isSearchDimmed || isDimmed)
          ? 'rgba(255,255,255,0.25)'
          : isHighlighted ? '#f59e0b' : isSearchMatch ? '#fbbf24' : '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, node.x, textY);
      }
    },
    [selectedNode, connectedNodeIds, highlightedNodeId, searchQuery, searchMatchIds, searchResults.length, labelDisplayMode]
  );

  const linkColor = useCallback(
    (link: any) => {
      if (link._bridge) return 'rgba(0, 0, 0, 0)';

      if (!selectedNode) {
        if (searchQuery && searchResults.length > 0) {
          const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
          if (searchMatchIds.has(sourceId) || searchMatchIds.has(targetId)) {
            return 'rgba(245, 158, 11, 0.45)';
          }
          return 'rgba(148, 163, 184, 0.05)';
        }
        return 'rgba(148, 163, 184, 0.16)';
      }

      const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
      if (sourceId === selectedNode.id || targetId === selectedNode.id) {
        const connectedNode = graphData.nodes.find(
          (n) => n.id === (sourceId === selectedNode.id ? targetId : sourceId)
        );
        return (connectedNode?.color || '#3b82f6') + 'CC';
      }
      return 'rgba(148, 163, 184, 0.04)';
    },
    [selectedNode, graphData.nodes, searchQuery, searchResults.length, searchMatchIds]
  );

  const linkWidth = useCallback(
    (link: any) => {
      if (link._bridge) return 0;
      if (!selectedNode) {
        return 0.75;
      }
      const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
      if (sourceId === selectedNode.id || targetId === selectedNode.id) {
        return Math.max((link.strength || 1) * 1.8, 1.8);
      }
      return 0.2;
    },
    [selectedNode]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    graphData.nodes.forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [graphData.nodes]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`h-[calc(100vh-6.5rem)] max-w-7xl mx-auto relative rounded-xl border border-border-custom bg-surface overflow-hidden shadow-sm flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''
      }`}
    >
      {/* Top Technical Control Header */}
      <div className="z-10 flex flex-wrap items-center justify-between p-3.5 border-b border-border-custom bg-surface/90 backdrop-blur-md gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-blue/10 border border-slate-blue/20">
            <Network className="w-4 h-4 text-slate-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary">Knowledge Studio</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-elevated border border-border-custom text-text-secondary font-mono">
                {visibleGraphData.nodes.length} concepts &bull; {visibleGraphData.links.filter((l) => !l._bridge).length} relations
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Control Cluster */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find concept in graph..."
              className="pl-8 pr-7 py-1.5 rounded-lg bg-surface-elevated border border-border-custom text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-slate-blue w-44 sm:w-56 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setHighlightedNodeId(null);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-custom text-xs text-text-primary focus:outline-none focus:border-slate-blue"
          >
            <option value="all">All Types</option>
            {Object.keys(typeCounts).map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)} ({typeCounts[t]})
              </option>
            ))}
          </select>

          {/* Label Toggle */}
          <button
            onClick={() => {
              if (labelDisplayMode === 'auto') setLabelDisplayMode('all');
              else if (labelDisplayMode === 'all') setLabelDisplayMode('none');
              else setLabelDisplayMode('auto');
            }}
            className="p-1.5 rounded-lg bg-surface-elevated border border-border-custom text-text-secondary hover:text-text-primary transition-colors text-xs flex items-center gap-1"
            title={`Label Mode: ${labelDisplayMode}`}
          >
            {labelDisplayMode === 'none' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-slate-blue" />}
            <span className="capitalize hidden sm:inline">{labelDisplayMode}</span>
          </button>

          {/* Zoom In & Out */}
          <button
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 400)}
            className="p-1.5 rounded-lg bg-surface-elevated border border-border-custom text-text-secondary hover:text-text-primary transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 400)}
            className="p-1.5 rounded-lg bg-surface-elevated border border-border-custom text-text-secondary hover:text-text-primary transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Fit to Viewport */}
          <button
            onClick={() => {
              setSelectedNode(null);
              setHighlightedNodeId(null);
              graphRef.current?.zoomToFit(400, 50);
            }}
            className="p-1.5 rounded-lg bg-surface-elevated border border-border-custom text-text-secondary hover:text-text-primary transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Rebuild Knowledge Graph */}
          <button
            onClick={rebuildGraph}
            disabled={rebuilding}
            className="px-3 py-1.5 rounded-lg bg-slate-blue text-white text-xs font-medium hover:bg-slate-blue/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Extract new entities and sync connections from Vault"
          >
            {rebuilding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{rebuilding ? 'Syncing...' : 'Re-index'}</span>
          </button>

          {/* Ask AI About Graph */}
          <button
            onClick={() => router.push('/converse?prompt=' + encodeURIComponent('Analyze the topological relationships and clustering structure of my knowledge graph.'))}
            className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border-custom text-text-primary hover:border-slate-blue transition-colors text-xs font-medium flex items-center gap-1.5"
            title="Ask AI about this knowledge graph"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-blue" />
            <span className="hidden md:inline">Ask AI</span>
          </button>
        </div>
      </div>

      {/* Search Autocomplete Results */}
      <AnimatePresence>
        {searchQuery && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-14 right-4 w-72 z-30 rounded-xl bg-surface border border-border-custom overflow-hidden shadow-lg"
          >
            <div className="px-3 py-2 border-b border-border-custom text-[11px] text-text-tertiary">
              {searchResults.length} matching concept{searchResults.length === 1 ? '' : 's'}
            </div>
            <div className="max-h-60 overflow-y-auto">
              {searchResults.slice(0, 15).map((node) => (
                <button
                  key={node.id}
                  onClick={() => {
                    focusOnNode(node);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-elevated transition-colors text-left ${
                    highlightedNodeId === node.id ? 'bg-slate-blue/10' : ''
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: typeColors[node.type] || '#3b82f6' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary truncate">{node.label}</p>
                    <p className="text-[10px] text-text-tertiary capitalize">{node.type}</p>
                  </div>
                  <ArrowRight className="w-3 h-3 text-text-tertiary shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas Area */}
      <div className="flex-1 w-full h-full relative bg-[#090d16]">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Network className="w-12 h-12 mx-auto mb-3 text-text-tertiary animate-pulse" />
              <p className="text-xs text-text-secondary">Rendering conceptual topology...</p>
            </div>
          </div>
        ) : visibleGraphData.nodes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <Network className="w-12 h-12 mx-auto mb-3 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text-primary mb-1">No Knowledge Nodes Found</h3>
              <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                Upload documents to the Knowledge Vault to automatically extract entities and conceptual relationships.
              </p>
              <button
                onClick={() => router.push('/vault')}
                className="px-3 py-1.5 rounded-lg bg-slate-blue text-white text-xs font-medium hover:bg-slate-blue/90 transition-all shadow-sm"
              >
                Go to Knowledge Vault
              </button>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={visibleGraphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, (node.val || 4) + 6, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkCurvature={0.12}
            backgroundColor="#090d16"
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => {
              setSelectedNode(null);
              setHighlightedNodeId(null);
            }}
            warmupTicks={150}
            cooldownTicks={250}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            onEngineStop={() => graphRef.current?.zoomToFit(400, 50)}
            enableNodeDrag={true}
            minZoom={0.2}
            maxZoom={8}
          />
        )}

        {/* Legend Overlay at Bottom-Left */}
        <div className="absolute bottom-3 left-3 z-10 p-2.5 rounded-lg bg-surface/90 border border-border-custom backdrop-blur-md shadow-xs">
          <div className="text-[10px] uppercase font-semibold text-text-tertiary mb-1.5 tracking-wider">
            Semantic Types
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {Object.entries(typeColors)
              .filter(([type]) => typeCounts[type])
              .map(([type, color]) => (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? 'all' : type)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all ${
                    filterType === type
                      ? 'bg-slate-blue/15 text-slate-blue font-medium'
                      : 'hover:bg-surface-elevated text-text-secondary'
                  }`}
                  title={`Click to filter by ${type}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[11px] capitalize">{type}</span>
                  <span className="text-[10px] text-text-tertiary">({typeCounts[type]})</span>
                </button>
              ))}
          </div>
        </div>

        {/* Selected Node Inspection Slide-Out Panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="absolute top-3 right-3 bottom-3 w-80 rounded-xl bg-surface border border-border-custom shadow-xl z-20 flex flex-col overflow-hidden"
            >
              {/* Node Header */}
              <div className="p-4 border-b border-border-custom">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: typeColors[selectedNode.type] || '#3b82f6' }}
                    />
                    <h3 className="font-semibold text-sm text-text-primary truncate">{selectedNode.label}</h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedNode(null);
                      setHighlightedNodeId(null);
                    }}
                    className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-custom text-text-secondary capitalize text-[11px]">
                    {selectedNode.type}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-custom text-text-secondary text-[11px] font-mono">
                    Weight: {(selectedNode.strength || 1).toFixed(1)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-custom text-text-secondary text-[11px] flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-slate-blue" />
                    {connectedNodes.length} connected
                  </span>
                </div>
              </div>

              {/* Actions Ribbon */}
              <div className="p-3 border-b border-border-custom bg-surface-elevated/40 flex items-center gap-2">
                <button
                  onClick={() => handleAskAboutNode(selectedNode)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-blue text-white text-xs font-medium hover:bg-slate-blue/90 transition-all shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask AI Twin</span>
                </button>
                <button
                  onClick={() => focusOnNode(selectedNode)}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border-custom text-text-secondary hover:text-text-primary text-xs"
                  title="Center & Zoom"
                >
                  Focus
                </button>
              </div>

              {/* Connected Relationships List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-text-tertiary font-semibold uppercase tracking-wider">
                  <span>Connected Concepts</span>
                  <span>({connectedNodes.length})</span>
                </div>

                {connectedNodes.length === 0 ? (
                  <p className="text-xs text-text-tertiary italic py-2">No direct topological connections.</p>
                ) : (
                  <div className="space-y-1">
                    {connectedNodes
                      .sort((a, b) => (b.strength || 1) - (a.strength || 1))
                      .map((node) => (
                        <button
                          key={node.id}
                          onClick={() => {
                            const fullNode = graphData.nodes.find((n) => n.id === node.id);
                            if (fullNode) focusOnNode(fullNode);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-elevated border border-transparent hover:border-border-custom transition-all text-left group"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: typeColors[node.type] || '#3b82f6' }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-text-primary truncate group-hover:text-slate-blue transition-colors">
                              {node.label}
                            </p>
                            <p className="text-[10px] text-text-tertiary capitalize">
                              {node.type} &bull; weight {(node.strength || 1).toFixed(1)}
                            </p>
                          </div>
                          <ArrowRight className="w-3 h-3 text-text-tertiary group-hover:text-slate-blue transition-colors" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
