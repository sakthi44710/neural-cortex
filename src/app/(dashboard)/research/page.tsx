'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  BookOpen,
  FileText,
  MessageSquare,
  Network,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  RefreshCw,
  Sliders,
  Globe,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface ResearchReport {
  title: string;
  executiveSummary: string;
  researchPlan: string[];
  keyFindings: {
    title: string;
    detail: string;
    confidence: 'high' | 'medium' | 'low';
    implications: string;
  }[];
  sources: {
    title: string;
    type: string;
    relevance: string;
  }[];
  contradictions: {
    aspect: string;
    perspectiveA: string;
    perspectiveB: string;
    synthesis: string;
  }[];
  knowledgeConnections: {
    concept: string;
    relatesTo: string;
    significance: string;
  }[];
  recommendations: string[];
}

function ResearchCenterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTopic = searchParams.get('topic') || '';
  const [topic, setTopic] = useState(initialTopic);
  const [depth, setDepth] = useState<'standard' | 'deep'>('deep');
  const [includeWeb, setIncludeWeb] = useState(true);
  const [saveToVault, setSaveToVault] = useState(true);

  const [activeStep, setActiveStep] = useState<number>(0);
  const [isResearching, setIsResearching] = useState(false);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'summary' | 'findings' | 'sources' | 'contradictions' | 'connections' | 'recommendations'
  >('summary');

  const [history, setHistory] = useState<
    { id: string; title: string; summary: string; createdAt: string; metadata?: string }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Fetch previous research history
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/brain/research');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to load research history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // If topic passed in URL, auto-fill
  useEffect(() => {
    if (initialTopic && !report && !isResearching) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  const executeResearch = async (targetTopic?: string) => {
    const queryTopic = (targetTopic || topic).trim();
    if (!queryTopic) return;

    setIsResearching(true);
    setReport(null);
    setSavedDocId(null);
    setActiveStep(1);

    // Simulated step transitions for transparent user visibility
    const stepTimer1 = setTimeout(() => setActiveStep(2), 1500);
    const stepTimer2 = setTimeout(() => setActiveStep(3), 3200);

    try {
      const res = await fetch('/api/brain/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: queryTopic,
          depth,
          includeWeb,
          saveToVault,
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Research synthesis failed');
      }

      const json = await res.json();
      setActiveStep(4);
      setReport(json.report);
      setSavedDocId(json.savedDocumentId);
      setActiveTab('summary');
      fetchHistory();
    } catch (err: any) {
      console.error('Error during research execution:', err);
      alert(err?.message || 'Unable to complete research synthesis. Please try again.');
    } finally {
      setIsResearching(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const md = `# ${report.title}
*Synthesized by Neural Cortex 2.0 Research Center*

## Executive Summary
${report.executiveSummary}

## Research Plan
${report.researchPlan.map((s) => `- ${s}`).join('\n')}

## Key Findings
${report.keyFindings
  .map(
    (k) => `### ${k.title} (${k.confidence.toUpperCase()} Confidence)
${k.detail}

*Implications:* ${k.implications}
`
  )
  .join('\n')}

## Contradictions & Nuance
${report.contradictions
  .map(
    (c) => `### ${c.aspect}
- **Perspective A:** ${c.perspectiveA}
- **Perspective B:** ${c.perspectiveB}
- **Synthesis:** ${c.synthesis}
`
  )
  .join('\n')}

## Knowledge Graph Connections
${report.knowledgeConnections
  .map((con) => `- **${con.concept}** ⇄ **${con.relatesTo}**: ${con.significance}`)
  .join('\n')}

## Recommendations
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_Research.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadPastReport = (item: any) => {
    try {
      if (item.metadata) {
        const parsed = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
        setReport(parsed);
        setTopic(parsed.title || item.title.replace('Research: ', ''));
        setActiveTab('summary');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('No metadata');
      }
    } catch {
      setReport({
        title: item.title,
        executiveSummary: item.summary,
        researchPlan: ['Archived Report from Vault'],
        keyFindings: [],
        sources: [],
        contradictions: [],
        knowledgeConnections: [],
        recommendations: [],
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-primary)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-muted)] uppercase tracking-wider">
              Research Center 2.0
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">• Deep Multi-Source Synthesis</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Autonomous AI Research Laboratory
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Formulates research plans, interrogates your vault, retrieves external evidence, and synthesizes structured reports.
          </p>
        </div>
      </div>

      {/* Research Query Console */}
      <div className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isResearching && executeResearch()}
              placeholder="Enter a research topic, architectural question, or domain inquiry..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
              disabled={isResearching}
            />
          </div>

          <button
            onClick={() => executeResearch()}
            disabled={!topic.trim() || isResearching}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 shrink-0 shadow-sm"
          >
            {isResearching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Launch Research</span>
              </>
            )}
          </button>
        </div>

        {/* Options & Quick Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWeb}
                onChange={(e) => setIncludeWeb(e.target.checked)}
                className="rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Include Web Search & Academic Literature</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToVault}
                onChange={(e) => setSaveToVault(e.target.checked)}
                className="rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
              <span>Autosave Report to Knowledge Vault</span>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-tertiary)]">Suggestions:</span>
            {[
              'B-Tree vs LSM-Tree Storage Engines',
              'Database Normalization Tradeoffs',
              'Raft Consensus State Machine Replication',
            ].map((sug) => (
              <button
                key={sug}
                onClick={() => {
                  setTopic(sug);
                  executeResearch(sug);
                }}
                disabled={isResearching}
                className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] hover:bg-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[11px]"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Stage Research Progress Indicator */}
      {isResearching && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
              Active Research Pipeline
            </span>
            <span className="text-xs text-[var(--text-tertiary)] font-mono">Stage {activeStep} of 4</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            {[
              { num: 1, label: 'Plan Formulation', desc: 'Defining research axes & queries' },
              { num: 2, label: 'Knowledge Retrieval', desc: 'Interrogating Vault docs & graph' },
              { num: 3, label: 'Cross-Synthesis', desc: 'Comparing sources & finding nuances' },
              { num: 4, label: 'Report Compilation', desc: 'Assembling findings & schema' },
            ].map((st) => (
              <div
                key={st.num}
                className={`p-3 rounded-lg border transition-all ${
                  activeStep === st.num
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-medium'
                    : activeStep > st.num
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500'
                    : 'border-[var(--border-primary)] bg-[var(--surface-elevated)] text-[var(--text-tertiary)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {activeStep > st.num ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : activeStep === st.num ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
                  ) : (
                    <span className="w-3.5 h-3.5 flex items-center justify-center font-mono text-[10px]">
                      {st.num}
                    </span>
                  )}
                  <span className="font-semibold">{st.label}</span>
                </div>
                <p className="text-[11px] opacity-80">{st.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Main Report View */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] overflow-hidden shadow-sm"
        >
          {/* Report Header Toolbar */}
          <div className="p-6 border-b border-[var(--border-primary)] bg-[var(--surface-elevated)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  SYNTHESIS COMPLETE
                </span>
                {savedDocId && (
                  <Link
                    href={`/vault?doc=${savedDocId}`}
                    className="text-[11px] text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                  >
                    <span>Saved in Knowledge Vault</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{report.title}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-elevated)] text-xs font-medium text-[var(--text-primary)] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Markdown</span>
              </button>
              <button
                onClick={() =>
                  router.push(
                    `/converse?q=${encodeURIComponent(
                      `Let's discuss my research report on "${report.title}". Specifically regarding: ${report.executiveSummary.slice(
                        0,
                        150
                      )}...`
                    )}`
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discuss in Converse</span>
              </button>
            </div>
          </div>

          {/* Report Sub-navigation */}
          <div className="flex items-center gap-1 px-6 border-b border-[var(--border-primary)] bg-[var(--surface-primary)] overflow-x-auto">
            {[
              { id: 'summary', label: 'Executive Summary' },
              { id: 'findings', label: `Key Findings (${report.keyFindings.length})` },
              { id: 'contradictions', label: `Nuance & Debates (${report.contradictions.length})` },
              { id: 'connections', label: `Knowledge Graph (${report.knowledgeConnections.length})` },
              { id: 'sources', label: `Sources (${report.sources.length})` },
              { id: 'recommendations', label: `Recommendations (${report.recommendations.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  activeTab === tab.id
                    ? 'border-[var(--accent-primary)] text-[var(--text-primary)] font-semibold'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Panels */}
          <div className="p-6">
            {activeTab === 'summary' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    Executive Synthesis
                  </h3>
                  <div className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] leading-relaxed text-sm text-[var(--text-primary)]">
                    {report.executiveSummary}
                  </div>
                </div>

                {report.researchPlan && report.researchPlan.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                      Executed Research Plan
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {report.researchPlan.map((step, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs text-[var(--text-secondary)] flex items-start gap-2"
                        >
                          <span className="font-mono text-[var(--accent-primary)] font-bold">
                            0{idx + 1}.
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'findings' && (
              <div className="space-y-4">
                {report.keyFindings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--text-tertiary)] font-bold">
                          #{idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {finding.title}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {finding.confidence} confidence
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {finding.detail}
                    </p>

                    {finding.implications && (
                      <div className="text-[11px] pt-2 border-t border-[var(--border-primary)] text-[var(--text-tertiary)]">
                        <strong className="text-[var(--text-secondary)]">Implications: </strong>
                        {finding.implications}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'contradictions' && (
              <div className="space-y-4">
                {report.contradictions.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] text-center py-8">
                    No conflicting viewpoints detected for this domain. The evidence demonstrates consensus.
                  </p>
                ) : (
                  report.contradictions.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] space-y-3"
                    >
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{c.aspect}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)]">
                          <span className="text-[10px] font-bold uppercase text-[var(--accent-primary)] block mb-1">
                            Perspective A
                          </span>
                          <p className="text-[var(--text-secondary)]">{c.perspectiveA}</p>
                        </div>
                        <div className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)]">
                          <span className="text-[10px] font-bold uppercase text-purple-400 block mb-1">
                            Perspective B
                          </span>
                          <p className="text-[var(--text-secondary)]">{c.perspectiveB}</p>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-primary)]">Architectural Synthesis: </strong>
                        {c.synthesis}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'connections' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {report.knowledgeConnections.map((con, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] space-y-2"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                      <span className="truncate">{con.concept}</span>
                      <span className="text-[var(--text-tertiary)] font-mono">⇄</span>
                      <span className="truncate">{con.relatesTo}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{con.significance}</p>
                    <div className="pt-2 flex justify-end">
                      <Link
                        href={`/studio?focus=${encodeURIComponent(con.concept)}`}
                        className="text-[11px] text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Locate in Studio</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'sources' && (
              <div className="space-y-3">
                {report.sources.map((src, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] flex items-center justify-between text-xs"
                  >
                    <div>
                      <h4 className="font-semibold text-[var(--text-primary)]">{src.title}</h4>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{src.relevance}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--border-primary)] text-[var(--text-secondary)] capitalize shrink-0">
                      {src.type}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="space-y-2.5">
                {report.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] flex items-center gap-3 text-xs text-[var(--text-primary)]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Past Research History */}
      <div className="p-6 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Saved Research Dossiers
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Previous research reports synthesized and archived in your Knowledge Vault.
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--text-tertiary)]">
            {history.length} saved
          </span>
        </div>

        {historyLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-[var(--surface-elevated)] animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-6">
            No research reports created yet. Enter a topic above to generate your first dossier.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => loadPastReport(item)}
                className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] hover:border-[var(--accent-primary)] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] mb-1.5">
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    <span className="text-emerald-500 font-mono text-[10px]">Report</span>
                  </div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">
                    {item.title.replace('Research: ', '')}
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-1.5">
                    {item.summary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border-primary)] text-[11px] text-[var(--accent-primary)] font-medium">
                  <span>Open Dossier</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">
          Initializing Research Laboratory...
        </div>
      }
    >
      <ResearchCenterContent />
    </Suspense>
  );
}
