'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  FileText,
  MessageSquare,
  Sparkles,
  Settings,
  Edit3,
  Trash2,
  Save,
  Download,
  Share2,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Sliders,
  Layers,
  Search,
  Code,
  ListOrdered,
  Maximize2,
} from 'lucide-react';
import ChatMarkdown from '@/components/shared/ChatMarkdown';

interface Artifact {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  domain: string;
  customInstructions: string;
  documentIds: string[];
  conversationIds: string[];
  artifacts: Artifact[];
  createdAt: string;
  updatedAt: string;
}

function ProjectsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Available vault docs for linking
  const [vaultDocs, setVaultDocs] = useState<{ id: string; title: string; domain: string }[]>([]);

  // Project Tabs: overview | knowledge | artifacts | settings
  const [projectTab, setProjectTab] = useState<'overview' | 'knowledge' | 'artifacts' | 'settings'>('overview');

  // New Project Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('Computer Science');
  const [newProjectInstructions, setNewProjectInstructions] = useState('');

  // Selected Artifact for Editing
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactEditMode, setArtifactEditMode] = useState<'edit' | 'preview'>('preview');
  const [artifactDraft, setArtifactDraft] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const fetchProjects = async () => {
    try {
      const [projRes, docsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/documents'),
      ]);

      if (projRes.ok) {
        const json = await projRes.json();
        setProjects(json.projects || []);
        if (json.projects && json.projects.length > 0 && !activeProjectId) {
          setActiveProjectId(json.projects[0].id);
        }
      }

      if (docsRes.ok) {
        const docsJson = await docsRes.json();
        setVaultDocs(
          (docsJson.documents || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            domain: d.domain || 'general',
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // Sync active artifact draft
  useEffect(() => {
    if (activeArtifact) {
      setArtifactDraft(activeArtifact.content);
    }
  }, [activeArtifact]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDesc,
          domain: newProjectDomain,
          customInstructions: newProjectInstructions,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setProjects([json.project, ...projects]);
        setActiveProjectId(json.project.id);
        setShowCreateModal(false);
        setNewProjectName('');
        setNewProjectDesc('');
        setNewProjectInstructions('');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateActiveProject = async (updates: Partial<Project>) => {
    if (!activeProject) return;
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeProject.id,
          ...updates,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setProjects(projects.map((p) => (p.id === activeProject.id ? json.project : p)));
      }
    } catch (err) {
      console.error('Failed to update project:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project workspace?')) return;
    try {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = projects.filter((p) => p.id !== id);
        setProjects(remaining);
        if (remaining.length > 0) setActiveProjectId(remaining[0].id);
        else setActiveProjectId(null);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  // Artifact AI actions: rewrite, expand, summarize, change_tone
  const handleArtifactAiAction = async (action: string, tone?: string) => {
    if (!artifactDraft || isAiProcessing) return;
    setIsAiProcessing(true);
    try {
      const res = await fetch('/api/projects/artifact-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          tone,
          content: artifactDraft,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setArtifactDraft(json.result);
        setArtifactEditMode('preview');
      }
    } catch (err) {
      console.error('Artifact action failed:', err);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSaveArtifactChanges = () => {
    if (!activeProject || !activeArtifact) return;
    const updatedArtifacts = activeProject.artifacts.map((a) =>
      a.id === activeArtifact.id ? { ...a, content: artifactDraft } : a
    );
    handleUpdateActiveProject({ artifacts: updatedArtifacts });
    setActiveArtifact({ ...activeArtifact, content: artifactDraft });
  };

  const handleCreateNewArtifact = () => {
    if (!activeProject) return;
    const newArt: Artifact = {
      id: `art_${Date.now()}`,
      title: 'New Knowledge Artifact',
      type: 'document',
      content: '# New Artifact\n\nDraft your report, notes, or study guide here...',
      createdAt: new Date().toISOString(),
    };
    const updated = [newArt, ...(activeProject.artifacts || [])];
    handleUpdateActiveProject({ artifacts: updated });
    setActiveArtifact(newArt);
    setArtifactDraft(newArt.content);
    setArtifactEditMode('edit');
  };

  const handleExportArtifact = () => {
    if (!activeArtifact) return;
    const blob = new Blob([artifactDraft], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeArtifact.title.replace(/[^\w\s-]/g, '')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-64 bg-[var(--surface-primary)] rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="h-96 rounded-xl bg-[var(--surface-primary)] animate-pulse" />
          <div className="md:col-span-3 h-96 rounded-xl bg-[var(--surface-primary)] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-primary)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-muted)] uppercase tracking-wider">
              Project Hub 2.0
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">• Dedicated Knowledge Workspaces</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Projects & Artifact Workspace
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Organize documents, custom AI system instructions, and interactive study/research artifacts into scoped workspaces.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors shadow-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Project Workspace</span>
        </button>
      </div>

      {/* Main Layout: Project Navigator (Left) + Workspace (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Projects List */}
        <div className="md:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Workspaces ({projects.length})
            </span>
          </div>

          <div className="space-y-2">
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    setActiveArtifact(null);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)] shadow-sm'
                      : 'border-[var(--border-primary)] bg-[var(--surface-primary)] hover:border-[var(--border-secondary)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {proj.name}
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border-primary)] text-[var(--text-tertiary)]">
                      {proj.domain}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1">
                    {proj.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] mt-3 pt-2.5 border-t border-[var(--border-primary)]">
                    <span>{proj.documentIds.length} sources</span>
                    <span>•</span>
                    <span>{proj.artifacts.length} artifacts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Project Details */}
        <div className="md:col-span-8">
          {activeProject ? (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] overflow-hidden shadow-sm">
              {/* Project Title Bar */}
              <div className="p-6 border-b border-[var(--border-primary)] bg-[var(--surface-elevated)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-muted)]">
                      {activeProject.domain}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      Updated {new Date(activeProject.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    {activeProject.name}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      router.push(
                        `/converse?project=${encodeURIComponent(
                          activeProject.name
                        )}&instructions=${encodeURIComponent(activeProject.customInstructions)}`
                      )
                    }
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Converse in Project</span>
                  </button>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-1 px-6 border-b border-[var(--border-primary)] bg-[var(--surface-primary)] overflow-x-auto">
                {[
                  { id: 'overview', label: 'Overview & Directives' },
                  { id: 'knowledge', label: `Linked Vault Docs (${activeProject.documentIds.length})` },
                  { id: 'artifacts', label: `Artifact Workspace (${activeProject.artifacts.length})` },
                  { id: 'settings', label: 'Project Settings' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setProjectTab(t.id as any);
                      if (t.id !== 'artifacts') setActiveArtifact(null);
                    }}
                    className={`px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                      projectTab === t.id
                        ? 'border-[var(--accent-primary)] text-[var(--text-primary)] font-semibold'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Overview & Custom Instructions */}
              {projectTab === 'overview' && (
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      Project Description
                    </label>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {activeProject.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Project-specific AI instructions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                          Project AI System Directive
                        </label>
                      </div>
                      <span className="text-[11px] text-[var(--text-tertiary)]">
                        Governs all AI reasoning in this workspace
                      </span>
                    </div>

                    <textarea
                      rows={3}
                      value={activeProject.customInstructions}
                      onChange={(e) =>
                        handleUpdateActiveProject({ customInstructions: e.target.value })
                      }
                      placeholder="e.g. Explain concepts at university exam level. Always provide SQL snippets and query plan tradeoffs."
                      className="w-full p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] leading-relaxed"
                    />
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      When operating in Converse or Research under this project, the AI Twin strictly adheres to these instructions.
                    </p>
                  </div>

                  {/* Quick summary stats */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)]">
                      <span className="text-xs text-[var(--text-tertiary)]">Knowledge Sources</span>
                      <div className="text-xl font-bold text-[var(--text-primary)] mt-1">
                        {activeProject.documentIds.length}
                      </div>
                      <button
                        onClick={() => setProjectTab('knowledge')}
                        className="text-xs text-[var(--accent-primary)] hover:underline mt-2 flex items-center gap-1"
                      >
                        <span>Manage sources</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)]">
                      <span className="text-xs text-[var(--text-tertiary)]">Artifacts & Guides</span>
                      <div className="text-xl font-bold text-[var(--text-primary)] mt-1">
                        {activeProject.artifacts.length}
                      </div>
                      <button
                        onClick={() => setProjectTab('artifacts')}
                        className="text-xs text-[var(--accent-primary)] hover:underline mt-2 flex items-center gap-1"
                      >
                        <span>Open artifact editor</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Linked Knowledge Documents */}
              {projectTab === 'knowledge' && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Associated Knowledge Vault Documents
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        These documents provide primary grounding for this workspace.
                      </p>
                    </div>
                  </div>

                  {/* Document selector toggles */}
                  <div className="space-y-2">
                    {vaultDocs.length === 0 ? (
                      <p className="text-xs text-[var(--text-tertiary)] py-6 text-center">
                        No documents found in Knowledge Vault. Upload documents first.
                      </p>
                    ) : (
                      vaultDocs.map((doc) => {
                        const isLinked = activeProject.documentIds.includes(doc.id);
                        return (
                          <div
                            key={doc.id}
                            className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                              isLinked
                                ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-subtle)]/50'
                                : 'border-[var(--border-primary)] bg-[var(--surface-elevated)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText
                                className={`w-4 h-4 shrink-0 ${
                                  isLinked ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
                                }`}
                              />
                              <div className="truncate">
                                <span className="text-xs font-semibold text-[var(--text-primary)] block truncate">
                                  {doc.title}
                                </span>
                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                  {doc.domain}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                const newIds = isLinked
                                  ? activeProject.documentIds.filter((id) => id !== doc.id)
                                  : [...activeProject.documentIds, doc.id];
                                handleUpdateActiveProject({ documentIds: newIds });
                              }}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                isLinked
                                  ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]'
                                  : 'border border-[var(--border-primary)] bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                              }`}
                            >
                              {isLinked ? 'Linked' : 'Link to Project'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Artifact Workspace & Editor */}
              {projectTab === 'artifacts' && (
                <div className="p-6 space-y-6">
                  {/* If an artifact is open for editing/reviewing */}
                  {activeArtifact ? (
                    <div className="space-y-4">
                      {/* Editor Toolbar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)]">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveArtifact(null)}
                            className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                          >
                            <span>← Back to Artifacts</span>
                          </button>
                          <span className="text-[var(--border-primary)]">|</span>
                          <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[200px]">
                            {activeArtifact.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Mode toggle */}
                          <div className="flex items-center rounded border border-[var(--border-primary)] bg-[var(--surface-primary)] p-0.5">
                            <button
                              onClick={() => setArtifactEditMode('preview')}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                artifactEditMode === 'preview'
                                  ? 'bg-[var(--accent-primary)] text-white'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => setArtifactEditMode('edit')}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                artifactEditMode === 'edit'
                                  ? 'bg-[var(--accent-primary)] text-white'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Edit Raw
                            </button>
                          </div>

                          <button
                            onClick={handleSaveArtifactChanges}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>

                          <button
                            onClick={handleExportArtifact}
                            className="flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* AI Transformation Actions Toolbar */}
                      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs">
                        <span className="text-[11px] font-semibold text-[var(--accent-primary)] flex items-center gap-1 mr-1">
                          <Sparkles className="w-3 h-3" />
                          <span>AI Assist:</span>
                        </span>
                        {[
                          { label: 'Rewrite & Polish', action: 'rewrite' },
                          { label: 'Expand Technical Depth', action: 'expand' },
                          { label: 'Executive Summary', action: 'summarize' },
                          { label: 'Make Concise', action: 'change_tone', tone: 'concise' },
                          { label: 'Academic Rigor', action: 'change_tone', tone: 'academic' },
                        ].map((btn, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleArtifactAiAction(btn.action, btn.tone)}
                            disabled={isAiProcessing}
                            className="px-2.5 py-1 rounded bg-[var(--surface-elevated)] hover:bg-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[11px] flex items-center gap-1 disabled:opacity-50"
                          >
                            {isAiProcessing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : null}
                            <span>{btn.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Content Workspace */}
                      {artifactEditMode === 'edit' ? (
                        <textarea
                          rows={16}
                          value={artifactDraft}
                          onChange={(e) => setArtifactDraft(e.target.value)}
                          className="w-full p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] leading-relaxed"
                        />
                      ) : (
                        <div className="p-6 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] prose max-w-none">
                          <ChatMarkdown content={artifactDraft} />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Artifacts list view */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            Knowledge Artifacts & Deliverables
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            Editable reports, study guides, synthesized decks, and technical notes.
                          </p>
                        </div>
                        <button
                          onClick={handleCreateNewArtifact}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Artifact</span>
                        </button>
                      </div>

                      {(!activeProject.artifacts || activeProject.artifacts.length === 0) ? (
                        <div className="p-8 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-center space-y-2">
                          <BookOpen className="w-8 h-8 text-[var(--text-tertiary)] mx-auto" />
                          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                            No Artifacts in this Workspace
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                            Generate study guides from the Vault, conduct deep investigations in the Research Center, or click New Artifact to start authoring.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {activeProject.artifacts.map((art) => (
                            <div
                              key={art.id}
                              onClick={() => setActiveArtifact(art)}
                              className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] hover:border-[var(--accent-primary)] transition-all cursor-pointer flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] mb-1">
                                  <span className="uppercase text-[10px] font-mono text-[var(--accent-primary)]">
                                    {art.type}
                                  </span>
                                  <span>{new Date(art.createdAt).toLocaleDateString()}</span>
                                </div>
                                <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                                  {art.title}
                                </h4>
                                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1">
                                  {art.content.replace(/^[#\s]+/, '').slice(0, 120)}...
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border-primary)] text-xs text-[var(--accent-primary)] font-medium">
                                <span>Open in Artifact Editor</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Project Settings */}
              {projectTab === 'settings' && (
                <div className="p-6 space-y-6">
                  <div className="space-y-4 max-w-lg">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        Project Name
                      </label>
                      <input
                        type="text"
                        value={activeProject.name}
                        onChange={(e) => handleUpdateActiveProject({ name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        Domain / Subject
                      </label>
                      <input
                        type="text"
                        value={activeProject.domain}
                        onChange={(e) => handleUpdateActiveProject({ domain: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        value={activeProject.description}
                        onChange={(e) => handleUpdateActiveProject({ description: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>

                    <div className="pt-4 border-t border-[var(--border-primary)]">
                      <button
                        onClick={() => handleDeleteProject(activeProject.id)}
                        className="px-3.5 py-2 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Project Workspace</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] text-center space-y-3">
              <FolderKanban className="w-10 h-10 text-[var(--text-tertiary)] mx-auto" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                No Project Workspace Selected
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Select an existing project workspace from the left or create a new dedicated domain workspace.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Create Project Workspace
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. DBMS Semester Preparation"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Domain</label>
                  <input
                    type="text"
                    value={newProjectDomain}
                    onChange={(e) => setNewProjectDomain(e.target.value)}
                    placeholder="e.g. Computer Science, AI Systems"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
                  <textarea
                    rows={2}
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Short description of this project's goals..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Project-Specific AI Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={newProjectInstructions}
                    onChange={(e) => setNewProjectInstructions(e.target.value)}
                    placeholder="e.g. Explain concepts at university exam level."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-elevated)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || saving}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  Create Workspace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">
          Loading Project Workspace...
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
