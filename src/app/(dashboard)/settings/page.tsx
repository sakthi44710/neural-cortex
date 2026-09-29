'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Shield,
  Palette,
  Save,
  Check,
  Brain,
  Zap,
  Eye,
  Workflow,
  Sparkles,
  Gauge,
  Database,
  FileCode,
  Layers,
  Cpu,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface SettingsState {
  theme: string;
  density: string;
  notifications: boolean;
  aiProcessing: boolean;
  privacyLevel: string;
  // AI Inference & Model
  aiModel: string;
  temperatureMode: 'deterministic' | 'balanced' | 'creative';
  contextLength: number;
  // Visual & Diagram Evaluation
  visualEvaluation: boolean;
  autoMermaid: boolean;
  extractOfficeMedia: boolean;
  saveDiagramNodes: boolean;
  // Performance & Caching
  fastBriefCache: boolean;
  selectiveRag: boolean;
  streamingEnabled: boolean;
}

const defaultSettings: SettingsState = {
  theme: 'dark',
  density: 'comfortable',
  notifications: true,
  aiProcessing: true,
  privacyLevel: 'local',
  aiModel: 'meta/llama-3.2-11b-vision-instruct',
  temperatureMode: 'deterministic',
  contextLength: 8192,
  visualEvaluation: true,
  autoMermaid: true,
  extractOfficeMedia: true,
  saveDiagramNodes: true,
  fastBriefCache: true,
  selectiveRag: true,
  streamingEnabled: true,
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [saved, setSaved] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('neural_cortex_settings');
      if (stored) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch { }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('neural_cortex_settings', JSON.stringify(settings));
    } catch { }
    setSaved(true);
    toast.success('Configuration saved & synced across Neural Cortex');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearCache = async () => {
    setCacheClearing(true);
    try {
      // Clear client storage
      sessionStorage.clear();
      toast.success('Cognitive telemetry cache cleared. Re-indexing fresh state.');
    } catch {
      toast.error('Failed to clear cache');
    } finally {
      setTimeout(() => setCacheClearing(false), 500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-neon-blue/10 text-neon-blue border border-neon-blue/20">
              System Control
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] text-neon-green bg-neon-green/10 border border-neon-green/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              NVIDIA NIM Active
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">System &amp; AI Settings</h1>
          <p className="text-text-secondary text-sm mt-1">
            Configure multimodal neural models, visual diagram evaluation, response determinism, and performance caching.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary flex items-center gap-2 shrink-0 shadow-lg shadow-neon-blue/20"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Saved!' : 'Save Settings'}</span>
        </button>
      </div>

      {/* User Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl glass relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-bl from-neon-blue/10 via-neon-purple/5 to-transparent blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-neon-blue" />
          <h2 className="text-lg font-semibold">Account &amp; Identity</h2>
        </div>
        <div className="flex items-center gap-5">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || 'User'}
              width={64}
              height={64}
              className="rounded-2xl border border-white/10 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-blue via-indigo-600 to-neon-purple flex items-center justify-center text-2xl font-bold shadow-lg shadow-neon-blue/20 text-white">
              {session?.user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">{session?.user?.name || 'Authorized Twin'}</h3>
            <p className="text-text-secondary text-sm">{session?.user?.email || 'sakthiprakash604r@gmail.com'}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs px-2 py-0.5 rounded-md bg-neon-green/10 text-neon-green border border-neon-green/20">
                Cognitive Twin: Verified
              </span>
              <span className="text-xs text-text-secondary">&#x2022; Local SQLite Store</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* AI Model & Deterministic Response Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl glass space-y-6"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Models &amp; Determinism Engine</h2>
              <p className="text-xs text-text-secondary">Configure frontier NVIDIA NIM inference and response consistency</p>
            </div>
          </div>
          <span className="text-xs text-neon-purple bg-neon-purple/10 px-2.5 py-1 rounded-full border border-neon-purple/20 font-medium">
            NVIDIA NIM Multi-Agent
          </span>
        </div>

        {/* Primary Model Selection */}
        <div>
          <label className="text-sm font-medium mb-2.5 block text-white">Primary Cognitive Model</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                id: 'meta/llama-3.2-11b-vision-instruct',
                name: 'Llama 3.2 Vision 11B',
                desc: 'Fast multimodal OCR, diagram analysis & general reasoning',
                badge: 'Recommended',
              },
              {
                id: 'meta/llama-3.2-90b-vision-instruct',
                name: 'Llama 3.2 Vision 90B',
                desc: 'Ultra-high fidelity visual comprehension & deep synthesis',
                badge: 'Vision Pro',
              },
              {
                id: 'nvidia/nemotron-4-340b-instruct',
                name: 'Nemotron-4 340B',
                desc: 'Maximum synthetic reasoning & complex multi-turn logic',
                badge: 'High Reasoning',
              },
              {
                id: 'mistralai/mistral-nemo-12b-instruct',
                name: 'Mistral NeMo 12B',
                desc: 'Low latency fallback with compact footprint',
                badge: 'Ultra Fast',
              },
            ].map((model) => (
              <div
                key={model.id}
                onClick={() => setSettings({ ...settings, aiModel: model.id })}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${settings.aiModel === model.id
                    ? 'bg-gradient-to-r from-neon-purple/15 to-neon-blue/15 border-neon-purple/50 shadow-md shadow-neon-purple/10'
                    : 'bg-bg-secondary/60 border-white/10 hover:border-white/20 hover:bg-bg-secondary'
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-white">{model.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${settings.aiModel === model.id
                        ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                        : 'bg-white/5 text-text-secondary'
                      }`}
                  >
                    {model.badge}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{model.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Deterministic Output Control */}
        <div className="p-4 rounded-xl bg-bg-secondary/70 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-neon-blue" />
              <span className="text-sm font-semibold text-white">Response Consistency &amp; Determinism</span>
            </div>
            <span className="text-[11px] font-mono text-neon-blue bg-neon-blue/10 px-2 py-0.5 rounded">
              Temp: {settings.temperatureMode === 'deterministic' ? '0.1 (Strict)' : settings.temperatureMode === 'balanced' ? '0.4 (Balanced)' : '0.7 (Creative)'}
            </span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            When set to <strong className="text-white">Strict Deterministic (0.1)</strong>, asking the exact same question delivers stable, reproducible answers across sessions. Answers will automatically adapt when new documents or concept notes are added to your vault.
          </p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              {
                mode: 'deterministic',
                label: 'Strict Deterministic',
                desc: 'Identical answers until vault changes',
                badge: 'Recommended',
              },
              {
                mode: 'balanced',
                label: 'Balanced',
                desc: 'Minor stylistic variety',
                badge: '0.4 Temp',
              },
              {
                mode: 'creative',
                label: 'Exploratory',
                desc: 'Higher linguistic variance',
                badge: '0.7 Temp',
              },
            ].map((t) => (
              <button
                key={t.mode}
                onClick={() => setSettings({ ...settings, temperatureMode: t.mode as any })}
                className={`p-2.5 rounded-lg text-left transition-all border ${settings.temperatureMode === t.mode
                    ? 'bg-neon-blue/15 border-neon-blue text-white'
                    : 'bg-white/[0.02] border-white/5 text-text-secondary hover:text-white'
                  }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold">{t.label}</span>
                </div>
                <p className="text-[11px] opacity-75">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Visual & Diagram Evaluation Settings */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-2xl glass space-y-6"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neon-blue/10 border border-neon-blue/30 flex items-center justify-center">
              <Eye className="w-5 h-5 text-neon-blue" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Visual &amp; Diagram Ingestion Pipeline</h2>
              <p className="text-xs text-text-secondary">Extract, OCR, and synthesize charts, architecture, and flowcharts into executable diagrams</p>
            </div>
          </div>
          <span className="text-xs text-neon-green bg-neon-green/10 px-2.5 py-1 rounded-full border border-neon-green/20 font-medium">
            Active
          </span>
        </div>

        <div className="space-y-4">
          {/* Toggle: Multimodal Visual Ingestion */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-secondary/50 border border-white/5">
            <div className="space-y-0.5 max-w-xl">
              <p className="font-semibold text-sm text-white flex items-center gap-2">
                <span>Multimodal Image &amp; Diagram OCR</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-neon-blue/20 text-neon-blue">Llama 3.2 Vision</span>
              </p>
              <p className="text-text-secondary text-xs">
                Automatically scans uploaded images (PNG, JPG, WEBP, GIF, SVG) to extract readable text, labels, and architectural relationships.
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, visualEvaluation: !settings.visualEvaluation })}
              className={`w-12 h-6 rounded-full transition-colors shrink-0 ${settings.visualEvaluation ? 'bg-neon-blue' : 'bg-bg-tertiary'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.visualEvaluation ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>

          {/* Toggle: Auto-Mermaid Synthesis */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-secondary/50 border border-white/5">
            <div className="space-y-0.5 max-w-xl">
              <p className="font-semibold text-sm text-white flex items-center gap-2">
                <Workflow className="w-4 h-4 text-neon-purple" />
                <span>Executable Mermaid Diagram Synthesis</span>
              </p>
              <p className="text-text-secondary text-xs">
                Translates scanned visual flowcharts, system diagrams, and graphs into clean, interactive Mermaid.js blocks with zoom, pan, and SVG export.
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, autoMermaid: !settings.autoMermaid })}
              className={`w-12 h-6 rounded-full transition-colors shrink-0 ${settings.autoMermaid ? 'bg-neon-purple' : 'bg-bg-tertiary'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.autoMermaid ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>

          {/* Toggle: Office Document Media Extraction */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-secondary/50 border border-white/5">
            <div className="space-y-0.5 max-w-xl">
              <p className="font-semibold text-sm text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Embedded Office Media Extraction (.docx, .pptx)</span>
              </p>
              <p className="text-text-secondary text-xs">
                Inspects ZIP archives of Word and PowerPoint files to extract embedded figures and slides, running them through multimodal evaluation.
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, extractOfficeMedia: !settings.extractOfficeMedia })}
              className={`w-12 h-6 rounded-full transition-colors shrink-0 ${settings.extractOfficeMedia ? 'bg-cyan-500' : 'bg-bg-tertiary'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.extractOfficeMedia ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>

          {/* Toggle: Save Diagrams as Knowledge Nodes */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-secondary/50 border border-white/5">
            <div className="space-y-0.5 max-w-xl">
              <p className="font-semibold text-sm text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-neon-green" />
                <span>Knowledge Graph Diagram Indexing</span>
              </p>
              <p className="text-text-secondary text-xs">
                Registers all generated and uploaded diagrams as interactive &quot;diagram&quot; nodes in your Knowledge Graph with full Mermaid metadata.
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, saveDiagramNodes: !settings.saveDiagramNodes })}
              className={`w-12 h-6 rounded-full transition-colors shrink-0 ${settings.saveDiagramNodes ? 'bg-neon-green' : 'bg-bg-tertiary'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.saveDiagramNodes ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Latency & Performance Optimization */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-2xl glass space-y-6"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/30 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-neon-green" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Performance &amp; Cache Acceleration</h2>
              <p className="text-xs text-text-secondary">Sub-50ms page loading, selective vector hydration, and SSE streaming</p>
            </div>
          </div>
          <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full border border-cyan-400/20 font-medium">
            Sub-50ms Mode
          </span>
        </div>

        <div className="space-y-4">
          {/* Sub-50ms Daily Briefing Cache */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-secondary/50 border border-white/5">
            <div className="space-y-0.5 max-w-xl">
              <p className="font-semibold text-sm text-white">Sub-50ms Daily Briefing Cache</p>
              <p className="text-text-secondary text-xs">
                Immediately serves instantaneous cognitive telemetry on dashboard load, revalidating AI narrative summaries asynchronously in the background.
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, fastBriefCache: !settings.fastBriefCache })}
              className={`w-12 h-6 rounded-full transition-colors shrink-0 ${settings.fastBriefCache ? 'bg-neon-green' : 'bg-bg-tertiary'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.fastBriefCache ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>

          {/* Selective RAG Retrieval */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-secondary/50 border border-white/5">
            <div className="space-y-0.5 max-w-xl">
              <p className="font-semibold text-sm text-white">Selective RAG Vector Hydration</p>
              <p className="text-text-secondary text-xs">
                Scores document metadata in-memory and only queries full document text for top-ranked nodes, eliminating SQL payload bloat.
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, selectiveRag: !settings.selectiveRag })}
              className={`w-12 h-6 rounded-full transition-colors shrink-0 ${settings.selectiveRag ? 'bg-neon-blue' : 'bg-bg-tertiary'
                }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.selectiveRag ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>

          {/* Cache Wipe Action */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
            <div>
              <p className="text-sm font-semibold text-white">Flush Local Cognitive Telemetry</p>
              <p className="text-xs text-text-secondary">Purges stale client-side session caches and prompts fresh state retrieval</p>
            </div>
            <button
              onClick={handleClearCache}
              disabled={cacheClearing}
              className="px-3.5 py-2 rounded-xl text-xs font-medium border border-white/10 hover:border-white/30 bg-bg-secondary text-text-secondary hover:text-white flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cacheClearing ? 'animate-spin text-neon-blue' : ''}`} />
              <span>{cacheClearing ? 'Purging...' : 'Flush Cache'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Appearance & Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 rounded-2xl glass space-y-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <Palette className="w-5 h-5 text-neon-pink" />
          <h2 className="text-lg font-semibold">Appearance &amp; Icon Rail Layout</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium mb-2.5 block text-white">Color World</label>
            <div className="flex gap-2">
              {[
                { id: 'dark', label: 'Cyber Dark' },
                { id: 'midnight', label: 'Midnight Obsidian' },
                { id: 'deep-space', label: 'Deep Space' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSettings({ ...settings, theme: theme.id })}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${settings.theme === theme.id
                      ? 'bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border border-neon-blue/40 text-white'
                      : 'bg-bg-secondary/70 text-text-secondary hover:text-white border border-transparent'
                    }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2.5 block text-white">Content Density</label>
            <div className="flex gap-2">
              {['compact', 'comfortable', 'spacious'].map((d) => (
                <button
                  key={d}
                  onClick={() => setSettings({ ...settings, density: d })}
                  className={`px-3.5 py-2 rounded-xl text-xs capitalize font-medium transition-all ${settings.density === d
                      ? 'bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border border-neon-blue/40 text-white'
                      : 'bg-bg-secondary/70 text-text-secondary hover:text-white border border-transparent'
                    }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neon-blue/5 border border-neon-blue/15 text-xs text-text-secondary flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-neon-blue shrink-0 mt-0.5" />
          <p>
            The dashboard is active in <strong className="text-white">Icon Rail Navigation</strong> mode (w-[76px]) with hover flyout submenus and instant shortcut jumps (⌘1 - ⌘6).
          </p>
        </div>
      </motion.div>

      {/* Save Button Footer */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-between pt-4"
      >
        <p className="text-xs text-text-secondary">
          Settings are saved to local storage and active across all AI operations.
        </p>
        <button
          onClick={handleSave}
          className="btn-primary flex items-center gap-2 shadow-lg shadow-neon-blue/25"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Saved Successfully!' : 'Save Settings'}</span>
        </button>
      </motion.div>
    </div>
  );
}
