'use client';

import { useEffect, useState } from 'react';
import {
  Brain,
  FileText,
  MessageSquare,
  Network,
  Compass,
  Layers,
  ArrowRight,
  Sparkles,
  Upload,
  Activity,
  CheckCircle2,
  Clock,
  Share2,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  stats: {
    documents: number;
    conversations: number;
    nodes: number;
    insights: number;
    relationships: number;
    entities: number;
    growth: {
      recentDocuments: number;
      recentNodes: number;
      recentConversations: number;
    };
  };
  recentActivity: Array<{
    id: string;
    type: 'upload' | 'conversation' | 'knowledge' | 'artifact';
    title: string;
    subtitle: string;
    timestamp: string;
    href: string;
  }>;
  smartInsights: Array<{
    id: string;
    text: string;
    tag: string;
  }>;
  brief: string;
  userName: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/brain/brief');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const stats = data?.stats || {
    documents: 0,
    conversations: 0,
    nodes: 0,
    insights: 0,
    relationships: 0,
    entities: 0,
    growth: { recentDocuments: 0, recentNodes: 0, recentConversations: 0 },
  };

  const isNewUser = stats.documents === 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header — Cortex Command Center */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
              Cortex Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
            {getGreeting()}, {data?.userName?.split(' ')[0] || 'Sakthi'}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Your Knowledge Twin is active and synchronized.
          </p>
        </div>

        {/* Telemetry pill */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-surface-elevated border border-border-custom px-3 py-1.5 rounded-xl text-xs">
          <Activity className="w-3.5 h-3.5 text-accent" />
          <span className="text-text-secondary font-mono text-[11px]">RAG &amp; Graph:</span>
          <span className="text-emerald-500 font-medium font-mono text-[11px]">Ready</span>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Link
          href="/converse?new=true"
          className="p-3 rounded-xl bg-surface border border-border-custom hover:border-accent/40 hover:bg-surface-elevated transition-all flex items-center gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-accent" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
              New Dialogue
            </p>
            <p className="text-[10px] text-text-muted truncate">Ask Knowledge Twin</p>
          </div>
        </Link>

        <Link
          href="/vault?action=upload"
          className="p-3 rounded-xl bg-surface border border-border-custom hover:border-accent/40 hover:bg-surface-elevated transition-all flex items-center gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 border border-border-subtle">
            <Upload className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
              Upload Knowledge
            </p>
            <p className="text-[10px] text-text-muted truncate">Ingest PDF, DOCX</p>
          </div>
        </Link>

        <Link
          href="/research"
          className="p-3 rounded-xl bg-surface border border-border-custom hover:border-accent/40 hover:bg-surface-elevated transition-all flex items-center gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 border border-border-subtle">
            <Compass className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
              Start Research
            </p>
            <p className="text-[10px] text-text-muted truncate">Synthesize deep report</p>
          </div>
        </Link>

        <Link
          href="/studio"
          className="p-3 rounded-xl bg-surface border border-border-custom hover:border-accent/40 hover:bg-surface-elevated transition-all flex items-center gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 border border-border-subtle">
            <Network className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
              Knowledge Graph
            </p>
            <p className="text-[10px] text-text-muted truncate">Explore connections</p>
          </div>
        </Link>

        <Link
          href="/projects"
          className="p-3 rounded-xl bg-surface border border-border-custom hover:border-accent/40 hover:bg-surface-elevated transition-all flex items-center gap-3 group col-span-2 sm:col-span-1"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 border border-border-subtle">
            <Layers className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
              Open Projects
            </p>
            <p className="text-[10px] text-text-muted truncate">Workspaces &amp; contexts</p>
          </div>
        </Link>
      </div>

      {/* Knowledge Pulse Section */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Knowledge Pulse
            </h2>
          </div>
          <span className="text-[11px] text-text-muted font-mono">Live System Telemetry</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Documents Card */}
          <div className="p-4 rounded-xl bg-surface border border-border-custom">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted font-medium">Documents</span>
              <FileText className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">{stats.documents}</span>
              {stats.growth.recentDocuments > 0 && (
                <span className="text-[10px] font-mono text-emerald-500 font-medium">
                  +{stats.growth.recentDocuments} this week
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-1 truncate">Stored in Knowledge Vault</p>
          </div>

          {/* Concepts & Nodes */}
          <div className="p-4 rounded-xl bg-surface border border-border-custom">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted font-medium">Knowledge Nodes</span>
              <Network className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">{stats.nodes}</span>
              {stats.growth.recentNodes > 0 && (
                <span className="text-[10px] font-mono text-emerald-500 font-medium">
                  +{stats.growth.recentNodes} this week
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-1 truncate">Entities in semantic graph</p>
          </div>

          {/* Relationships Card */}
          <div className="p-4 rounded-xl bg-surface border border-border-custom">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted font-medium">Relationships</span>
              <Share2 className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">{stats.relationships}</span>
              <span className="text-[10px] font-mono text-text-muted">Interconnections</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 truncate">Cross-concept semantic links</p>
          </div>

          {/* Conversations Card */}
          <div className="p-4 rounded-xl bg-surface border border-border-custom">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted font-medium">Conversations</span>
              <MessageSquare className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">{stats.conversations}</span>
              {stats.growth.recentConversations > 0 && (
                <span className="text-[10px] font-mono text-emerald-500 font-medium">
                  +{stats.growth.recentConversations} active
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-1 truncate">Neural dialogue sessions</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Cognitive Brief & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Cognitive Brief & Insights (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Daily Cognitive Brief */}
          <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border-custom relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Daily Cognitive Brief
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent-subtle text-accent border border-accent/20">
                Deterministic Overview
              </span>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-2 py-2">
                <div className="h-3.5 bg-surface-elevated rounded w-5/6" />
                <div className="h-3.5 bg-surface-elevated rounded w-4/6" />
                <div className="h-3.5 bg-surface-elevated rounded w-3/4" />
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {data?.brief || 'Upload documents or research a topic to populate your cognitive brief.'}
              </p>
            )}
          </div>

          {/* Generated Real Insights */}
          <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border-custom">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Knowledge Analytics Insights
                </h3>
              </div>
              <Link href="/insights" className="text-[11px] text-accent hover:underline flex items-center gap-1">
                View all analytics <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {data?.smartInsights && data.smartInsights.length > 0 ? (
              <div className="space-y-2">
                {data.smartInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="p-3 rounded-lg bg-surface-elevated border border-border-subtle flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text-muted mr-2">
                        {insight.tag}
                      </span>
                      <p className="text-xs text-text-primary inline leading-relaxed">
                        {insight.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-text-muted">
                Insights will automatically appear here as you ingest documents and interact with your twin.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Activity Feed (5 cols) */}
        <div className="lg:col-span-5">
          <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border-custom h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Recent Activity
                </h3>
              </div>
              <span className="text-[11px] text-text-muted font-mono">Live Timeline</span>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-3 py-2 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-surface-elevated rounded-lg" />
                ))}
              </div>
            ) : data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-2 flex-1">
                {data.recentActivity.map((act) => (
                  <Link
                    key={act.id}
                    href={act.href}
                    className="p-2.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 hover:bg-surface-elevated/80 transition-all flex items-center justify-between group block"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-7 h-7 rounded-md bg-surface flex items-center justify-center shrink-0 border border-border-subtle">
                        {act.type === 'upload' && <FileText className="w-3.5 h-3.5 text-accent" />}
                        {act.type === 'conversation' && <MessageSquare className="w-3.5 h-3.5 text-text-secondary" />}
                        {act.type === 'knowledge' && <Network className="w-3.5 h-3.5 text-emerald-500" />}
                        {act.type === 'artifact' && <Sparkles className="w-3.5 h-3.5 text-accent" />}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                          {act.title}
                        </p>
                        <p className="text-[10px] text-text-muted truncate">{act.subtitle}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-text-muted flex-1 flex flex-col items-center justify-center">
                <FolderOpen className="w-8 h-8 mb-2 opacity-30 text-text-muted" />
                No recent activity recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Getting Started & Knowledge Guidance */}
      <div className="p-5 rounded-xl bg-surface border border-border-custom">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {isNewUser ? 'Onboarding Checklist' : 'Explore Your Knowledge OS'}
          </h3>
          <span className="text-[11px] text-text-muted font-mono">Neural Guidance</span>
        </div>

        {isNewUser ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/vault?action=upload"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block"
            >
              <span className="text-xs font-mono text-accent font-bold">01</span>
              <h4 className="text-xs font-semibold text-text-primary mt-1">Upload Your First Document</h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Drop a PDF or DOCX file to extract text, concepts, and diagrams automatically.
              </p>
            </Link>

            <Link
              href="/converse"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block"
            >
              <span className="text-xs font-mono text-accent font-bold">02</span>
              <h4 className="text-xs font-semibold text-text-primary mt-1">Ask Your Knowledge Twin</h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Query your documents with RAG synthesis, source citations, and Mermaid diagrams.
              </p>
            </Link>

            <Link
              href="/studio"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block"
            >
              <span className="text-xs font-mono text-accent font-bold">03</span>
              <h4 className="text-xs font-semibold text-text-primary mt-1">Explore Knowledge Graph</h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Navigate your semantic entity network and discover hidden cross-document links.
              </p>
            </Link>

            <Link
              href="/research"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block"
            >
              <span className="text-xs font-mono text-accent font-bold">04</span>
              <h4 className="text-xs font-semibold text-text-primary mt-1">Launch First Research</h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Produce executive summaries and multi-source research artifacts.
              </p>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/vault"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block group"
            >
              <h4 className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors flex items-center justify-between">
                Explore Knowledge Vault <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-accent" />
              </h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Inspect document summaries, extract study questions, or view visual diagrams.
              </p>
            </Link>

            <Link
              href="/research"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block group"
            >
              <h4 className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors flex items-center justify-between">
                Research a Topic <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-accent" />
              </h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Run an autonomous multi-stage investigation and generate comprehensive reports.
              </p>
            </Link>

            <Link
              href="/studio"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block group"
            >
              <h4 className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors flex items-center justify-between">
                Connect Related Concepts <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-accent" />
              </h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Traverse relationship paths and cluster concepts by semantic similarity.
              </p>
            </Link>

            <Link
              href="/projects"
              className="p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent/40 transition-colors block group"
            >
              <h4 className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors flex items-center justify-between">
                Organize in Projects <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-accent" />
              </h4>
              <p className="text-[11px] text-text-muted mt-1 leading-snug">
                Group documents, conversations, and custom instructions into dedicated contexts.
              </p>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
