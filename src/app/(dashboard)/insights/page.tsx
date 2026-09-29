'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Brain,
  Network,
  FileText,
  MessageSquare,
  Target,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertCircle,
  FolderKanban,
  CheckCircle2,
  Share2,
  ExternalLink,
  Search,
} from 'lucide-react';

interface InsightResponse {
  stats: {
    documents: number;
    conversations: number;
    nodes: number;
    relationships: number;
    projects: number;
    growth: {
      documents: number;
      nodes: number;
      conversations: number;
    };
  };
  topEntities: {
    name: string;
    count: number;
    sources: string[];
    type: string;
    connections: number;
  }[];
  domains: {
    name: string;
    docCount: number;
    entityCount: number;
    sampleDocs: string[];
    completenessScore: number;
  }[];
  timeline: {
    date: string;
    label: string;
    docs: number;
    nodes: number;
  }[];
  gaps: {
    id: string;
    domain: string;
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    recommendedTopic: string;
  }[];
  recentConnections: {
    source: string;
    target: string;
    strength: number;
    type: string;
  }[];
}

export default function InsightsPage() {
  const router = useRouter();
  const [data, setData] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'entities' | 'domains' | 'gaps'>('overview');
  const [hoveredTimelineIndex, setHoveredTimelineIndex] = useState<number | null>(null);

  const fetchInsights = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/brain/insights');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  // Compute SVG chart points for timeline
  const chartData = useMemo(() => {
    if (!data?.timeline || data.timeline.length === 0) return null;
    const maxVal = Math.max(...data.timeline.map((d) => Math.max(d.docs, d.nodes)), 4);
    const width = 600;
    const height = 180;
    const padding = 24;

    const stepX = (width - padding * 2) / (data.timeline.length - 1);

    const docPoints = data.timeline.map((d, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (d.docs / maxVal) * (height - padding * 2);
      return { x, y, val: d.docs, label: d.label };
    });

    const nodePoints = data.timeline.map((d, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (d.nodes / maxVal) * (height - padding * 2);
      return { x, y, val: d.nodes, label: d.label };
    });

    const docPath = docPoints.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );
    const nodePath = nodePoints.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );

    return { width, height, padding, docPoints, nodePoints, docPath, nodePath, maxVal };
  }, [data?.timeline]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-[var(--surface-primary)] rounded animate-pulse" />
            <div className="h-4 w-96 bg-[var(--surface-primary)] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] animate-pulse space-y-3">
              <div className="h-4 w-20 bg-[var(--surface-elevated)] rounded" />
              <div className="h-8 w-14 bg-[var(--surface-elevated)] rounded" />
            </div>
          ))}
        </div>
        <div className="h-72 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] animate-pulse" />
      </div>
    );
  }

  const stats = data?.stats || {
    documents: 0,
    conversations: 0,
    nodes: 0,
    relationships: 0,
    projects: 0,
    growth: { documents: 0, nodes: 0, conversations: 0 },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-primary)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-muted)] uppercase tracking-wider">
              Telemetry & Analytics
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">• Live DB Grounding</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Knowledge Analytics 2.0
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Objective metrics, topological connectivity, domain coverage, and detected conceptual gaps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchInsights}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] text-xs font-medium text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>
          <Link
            href="/studio"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Inspect Graph</span>
          </Link>
        </div>
      </div>

      {/* Primary Telemetry Pulse */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          {
            label: 'Documents',
            value: stats.documents,
            icon: FileText,
            growth: stats.growth.documents,
            sub: 'Active Vault sources',
          },
          {
            label: 'Knowledge Nodes',
            value: stats.nodes,
            icon: Brain,
            growth: stats.growth.nodes,
            sub: 'Extracted concepts',
          },
          {
            label: 'Relationships',
            value: stats.relationships,
            icon: Network,
            growth: null,
            sub: 'Cross-node edges',
          },
          {
            label: 'Conversations',
            value: stats.conversations,
            icon: MessageSquare,
            growth: stats.growth.conversations,
            sub: 'Reasoning threads',
          },
          {
            label: 'Domains Tracked',
            value: data?.domains.length || 0,
            icon: Target,
            growth: null,
            sub: 'Categorized subjects',
          },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:border-[var(--border-secondary)] transition-colors"
          >
            <div className="flex items-center justify-between text-[var(--text-tertiary)] mb-2">
              <span className="text-xs font-medium">{item.label}</span>
              <item.icon className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {item.value}
              </span>
              {item.growth !== null && item.growth > 0 && (
                <span className="text-[11px] font-medium text-emerald-500">
                  +{item.growth} 7d
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1 truncate">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-primary)]">
        {[
          { id: 'overview', label: 'Knowledge Growth' },
          { id: 'entities', label: `Top Entities (${data?.topEntities.length || 0})` },
          { id: 'domains', label: `Domain Distribution (${data?.domains.length || 0})` },
          { id: 'gaps', label: `Knowledge Gaps (${data?.gaps.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--accent-primary)] text-[var(--text-primary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & Growth Chart */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Knowledge Ingestion & Concept Discovery (Last 14 Days)
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Timeline of documents ingested vs. concepts discovered and mapped into the knowledge graph.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[var(--accent-primary)]" />
                  <span className="text-[var(--text-secondary)]">Documents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[var(--text-secondary)]">Concepts / Nodes</span>
                </div>
              </div>
            </div>

            {chartData ? (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[600px]">
                  <svg
                    viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                    className="w-full h-48 overflow-visible"
                  >
                    {/* Horizontal grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y =
                        chartData.padding +
                        ratio * (chartData.height - chartData.padding * 2);
                      return (
                        <line
                          key={ratio}
                          x1={chartData.padding}
                          y1={y}
                          x2={chartData.width - chartData.padding}
                          y2={y}
                          stroke="currentColor"
                          className="text-[var(--border-primary)]"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Document line */}
                    <path
                      d={chartData.docPath}
                      fill="none"
                      stroke="var(--accent-primary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Node line */}
                    <path
                      d={chartData.nodePath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Points & Interactive Tooltips */}
                    {chartData.docPoints.map((p, i) => (
                      <g key={`doc-${i}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={hoveredTimelineIndex === i ? 5 : 3.5}
                          fill="var(--surface-primary)"
                          stroke="var(--accent-primary)"
                          strokeWidth="2"
                          className="transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredTimelineIndex(i)}
                          onMouseLeave={() => setHoveredTimelineIndex(null)}
                        />
                      </g>
                    ))}

                    {chartData.nodePoints.map((p, i) => (
                      <g key={`node-${i}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={hoveredTimelineIndex === i ? 5 : 3.5}
                          fill="var(--surface-primary)"
                          stroke="#10b981"
                          strokeWidth="2"
                          className="transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredTimelineIndex(i)}
                          onMouseLeave={() => setHoveredTimelineIndex(null)}
                        />
                      </g>
                    ))}

                    {/* X-axis labels */}
                    {chartData.docPoints.map((p, i) => {
                      if (i % 2 !== 0 && i !== chartData.docPoints.length - 1) return null;
                      return (
                        <text
                          key={`label-${i}`}
                          x={p.x}
                          y={chartData.height - 4}
                          textAnchor="middle"
                          className="text-[10px] fill-[var(--text-tertiary)] select-none font-mono"
                        >
                          {p.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                Not enough history to generate timeline chart.
              </div>
            )}
          </div>

          {/* Newly Discovered Relationships */}
          <div className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Topological Relationships & Semantic Linkages
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Connections extracted between verified concepts in your knowledge base.
                </p>
              </div>
              <Link
                href="/studio"
                className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-medium"
              >
                <span>View Full Graph</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {(!data?.recentConnections || data.recentConnections.length === 0) ? (
              <p className="text-xs text-[var(--text-tertiary)] py-4 text-center">
                No active connections mapped yet. Upload and process interconnected documents to discover relationships.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.recentConnections.map((conn, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-[var(--text-primary)] truncate max-w-[120px]">
                        {conn.source}
                      </span>
                      <span className="text-[var(--text-tertiary)] px-1.5 font-mono text-[10px]">
                        ⇄
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] truncate max-w-[120px]">
                        {conn.target}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-primary)] text-[10px] text-[var(--text-tertiary)]">
                      <span className="capitalize">{conn.type}</span>
                      <button
                        onClick={() => router.push(`/studio?focus=${encodeURIComponent(conn.source)}`)}
                        className="text-[var(--accent-primary)] hover:underline flex items-center gap-0.5"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Top Entities */}
      {activeTab === 'entities' && (
        <div className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Extracted Entities & Key Concepts
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Top concepts ranked by occurrence frequency, document sources, and connection degree.
              </p>
            </div>
          </div>

          {(!data?.topEntities || data.topEntities.length === 0) ? (
            <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">
              No entities detected yet. Ingest documents in the Vault to extract concepts automatically.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {data.topEntities.map((entity, i) => (
                <div
                  key={entity.name}
                  className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] hover:border-[var(--border-secondary)] transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--text-tertiary)]">
                          #{i + 1}
                        </span>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {entity.name}
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-muted)] uppercase">
                        {entity.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-2">
                      <span>
                        <strong className="text-[var(--text-primary)]">{entity.count}</strong> mentions
                      </span>
                      <span>•</span>
                      <span>
                        <strong className="text-[var(--text-primary)]">{entity.connections}</strong> connections
                      </span>
                    </div>

                    {entity.sources && entity.sources.length > 0 && (
                      <div className="mt-2.5 text-[11px] text-[var(--text-tertiary)]">
                        <span className="text-[var(--text-secondary)]">Found in: </span>
                        {entity.sources.join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border-primary)]">
                    <button
                      onClick={() => router.push(`/studio?focus=${encodeURIComponent(entity.name)}`)}
                      className="flex-1 py-1.5 px-2.5 rounded bg-[var(--surface-primary)] hover:bg-[var(--border-primary)] text-xs text-[var(--text-primary)] font-medium text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Network className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Locate in Graph</span>
                    </button>
                    <button
                      onClick={() => router.push(`/converse?q=${encodeURIComponent(`Explain the core principles and connections of "${entity.name}" based on my documents.`)}`)}
                      className="flex-1 py-1.5 px-2.5 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ask AI Twin</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Knowledge Domains */}
      {activeTab === 'domains' && (
        <div className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)]">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Dynamic Subject Domains
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Categories dynamically constructed from your document metadata and key concepts.
            </p>
          </div>

          {(!data?.domains || data.domains.length === 0) ? (
            <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">
              No domains classified yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.domains.map((dom) => (
                <div
                  key={dom.name}
                  className="p-5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-[var(--text-primary)]">{dom.name}</h4>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                      {dom.docCount} {dom.docCount === 1 ? 'doc' : 'docs'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                      <span>Concept Density</span>
                      <span className="font-mono">{dom.completenessScore}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--surface-primary)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-500"
                        style={{ width: `${dom.completenessScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-[var(--text-tertiary)] space-y-1">
                    <div>
                      <span className="text-[var(--text-secondary)]">Concepts mapped:</span> {dom.entityCount}
                    </div>
                    {dom.sampleDocs.length > 0 && (
                      <div className="truncate">
                        <span className="text-[var(--text-secondary)]">Sources:</span> {dom.sampleDocs.join(', ')}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => router.push(`/vault?filter=${encodeURIComponent(dom.name.toLowerCase())}`)}
                    className="w-full py-1.5 px-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FolderKanban className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Filter Vault by Domain</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Knowledge Gaps */}
      {activeTab === 'gaps' && (
        <div className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Conceptual Gaps & Reasoning Blindspots
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Topological analysis identifies missing prerequisites, unlinked concepts, and low-density topics.
            </p>
          </div>

          {(!data?.gaps || data.gaps.length === 0) ? (
            <div className="p-8 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                No Critical Knowledge Gaps Detected
              </h4>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                Your existing documents exhibit balanced conceptual coverage. As you add more specialized material, Neural Cortex will flag missing logical prerequisites.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {data.gaps.map((gap) => {
                const badgeColor =
                  gap.severity === 'high'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    : gap.severity === 'medium'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-blue-500/10 text-blue-500 border-blue-500/20';

                return (
                  <div
                    key={gap.id}
                    className="p-5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{gap.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                          {gap.domain}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                          {gap.severity} priority
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {gap.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-primary)]">
                      <button
                        onClick={() =>
                          router.push(
                            `/converse?q=${encodeURIComponent(
                              `Let's explore the knowledge gap in my vault regarding "${gap.recommendedTopic}". What foundational concepts should I study?`
                            )}`
                          )
                        }
                        className="py-1 px-3 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Explore Gap with AI</span>
                      </button>
                      <button
                        onClick={() =>
                          router.push(
                            `/research?topic=${encodeURIComponent(gap.recommendedTopic)}`
                          )
                        }
                        className="py-1 px-3 rounded border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Search className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Start Deep Research</span>
                      </button>
                      <button
                        onClick={() => router.push('/vault')}
                        className="py-1 px-3 rounded border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] font-medium transition-colors flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Upload Related Document</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
