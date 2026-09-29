'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  MessageSquare,
  FileText,
  Network,
  Settings,
  Sparkles,
  Palette,
  FolderOpen,
  Compass,
  ArrowRight,
  X,
  Layers,
  BarChart3,
  Check,
} from 'lucide-react';

interface SearchResult {
  documents: Array<{
    id: string;
    title: string;
    fileType?: string;
    domain?: string;
    summary?: string;
    contentType?: string;
  }>;
  conversations: Array<{
    id: string;
    title: string;
    updatedAt: string;
    messages?: Array<{ content: string }>;
  }>;
  knowledgeNodes: Array<{
    id: string;
    label: string;
    type: string;
    description?: string;
  }>;
}

const THEMES = [
  { id: 'dark', name: 'Professional Dark', desc: 'Obsidian & Slate Blue' },
  { id: 'light', name: 'Professional Light', desc: 'Enterprise crisp white & slate' },
  { id: 'midnight', name: 'Midnight', desc: 'Deep navy atmosphere' },
  { id: 'graphite', name: 'Graphite', desc: 'Monochromatic neutral charcoal' },
  { id: 'high-contrast', name: 'High Contrast', desc: 'Maximum accessibility contrast' },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult>({ documents: [], conversations: [], knowledgeNodes: [] });
  const [activeTheme, setActiveTheme] = useState('dark');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Read current theme
  useEffect(() => {
    const saved = localStorage.getItem('nc_theme') || 'dark';
    setActiveTheme(saved);
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setResults({ documents: [], conversations: [], knowledgeNodes: [] });
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  // Listen for keyboard shortcut & custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    const handleCustomOpen = () => handleOpen();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, [isOpen, handleClose, handleOpen]);

  // Search debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults({ documents: [], conversations: [], knowledgeNodes: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const switchTheme = (themeId: string) => {
    setActiveTheme(themeId);
    localStorage.setItem('nc_theme', themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    if (themeId === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  const navigateTo = (url: string) => {
    handleClose();
    router.push(url);
  };

  if (!isOpen) return null;

  const hasResults =
    results.documents.length > 0 ||
    results.conversations.length > 0 ||
    results.knowledgeNodes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-2xl bg-surface-elevated border border-border-custom rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border-subtle gap-3">
          <Search className="w-5 h-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, conversations, entities, or commands..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded bg-surface border border-border-subtle text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-text-muted flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              Searching knowledge universe...
            </div>
          )}

          {/* Results View */}
          {query.trim() && !loading && (
            <>
              {!hasResults ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-text-secondary">No knowledge found matching &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-text-muted mt-1">Try another search term or ask in Converse</p>
                  <button
                    onClick={() => navigateTo(`/converse?initial=${encodeURIComponent(query)}`)}
                    className="mt-4 px-3.5 py-1.5 rounded-lg bg-surface border border-border-custom hover:border-accent text-xs text-text-primary inline-flex items-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-accent" />
                    Ask Knowledge Twin in Converse
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Documents */}
                  {results.documents.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold tracking-wider uppercase text-text-muted px-2 mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-accent" />
                        Documents ({results.documents.length})
                      </div>
                      <div className="space-y-1">
                        {results.documents.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => navigateTo(`/vault?docId=${doc.id}`)}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-surface border border-transparent hover:border-border-subtle transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-7 h-7 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5 text-accent" />
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                                  {doc.title}
                                </p>
                                {doc.summary && (
                                  <p className="text-[11px] text-text-muted truncate max-w-md">
                                    {doc.summary}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface text-text-muted border border-border-subtle shrink-0">
                              {doc.domain || doc.fileType || 'Doc'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conversations */}
                  {results.conversations.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold tracking-wider uppercase text-text-muted px-2 mb-1.5 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-accent" />
                        Conversations ({results.conversations.length})
                      </div>
                      <div className="space-y-1">
                        {results.conversations.map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => navigateTo(`/converse?id=${conv.id}`)}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-surface border border-transparent hover:border-border-subtle transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border-subtle">
                                <MessageSquare className="w-3.5 h-3.5 text-text-secondary" />
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                                  {conv.title}
                                </p>
                                {conv.messages?.[0]?.content && (
                                  <p className="text-[11px] text-text-muted truncate max-w-md">
                                    {conv.messages[0].content}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Knowledge Nodes */}
                  {results.knowledgeNodes.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold tracking-wider uppercase text-text-muted px-2 mb-1.5 flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5 text-accent" />
                        Knowledge Nodes ({results.knowledgeNodes.length})
                      </div>
                      <div className="space-y-1">
                        {results.knowledgeNodes.map((node) => (
                          <button
                            key={node.id}
                            onClick={() => navigateTo(`/studio?focus=${encodeURIComponent(node.label)}`)}
                            className="w-full text-left p-2.5 rounded-xl hover:bg-surface border border-transparent hover:border-border-subtle transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-7 h-7 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
                                <Network className="w-3.5 h-3.5 text-accent" />
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                                  {node.label}
                                </p>
                                {node.description && (
                                  <p className="text-[11px] text-text-muted truncate max-w-md">
                                    {node.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface text-text-muted border border-border-subtle">
                              {node.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Quick Actions (when query is empty) */}
          {!query.trim() && (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-semibold tracking-wider uppercase text-text-muted px-2 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  Quick Actions
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <button
                    onClick={() => navigateTo('/converse?new=true')}
                    className="p-2.5 rounded-xl hover:bg-surface border border-border-subtle hover:border-border-custom text-left flex items-center gap-3 group transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                        New Conversation
                      </p>
                      <p className="text-[11px] text-text-muted">Start fresh neural dialogue</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigateTo('/vault?action=upload')}
                    className="p-2.5 rounded-xl hover:bg-surface border border-border-subtle hover:border-border-custom text-left flex items-center gap-3 group transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border-subtle">
                      <FolderOpen className="w-4 h-4 text-text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                        Upload Knowledge
                      </p>
                      <p className="text-[11px] text-text-muted">Ingest PDF, DOCX, diagrams</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigateTo('/research')}
                    className="p-2.5 rounded-xl hover:bg-surface border border-border-subtle hover:border-border-custom text-left flex items-center gap-3 group transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border-subtle">
                      <Compass className="w-4 h-4 text-text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                        Start Research
                      </p>
                      <p className="text-[11px] text-text-muted">Synthesize multi-source reports</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigateTo('/studio')}
                    className="p-2.5 rounded-xl hover:bg-surface border border-border-subtle hover:border-border-custom text-left flex items-center gap-3 group transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border-subtle">
                      <Network className="w-4 h-4 text-text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                        Knowledge Studio
                      </p>
                      <p className="text-[11px] text-text-muted">Explore interactive graph</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigateTo('/projects')}
                    className="p-2.5 rounded-xl hover:bg-surface border border-border-subtle hover:border-border-custom text-left flex items-center gap-3 group transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border-subtle">
                      <Layers className="w-4 h-4 text-text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                        Projects Workspace
                      </p>
                      <p className="text-[11px] text-text-muted">Organize goal-oriented topics</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigateTo('/insights')}
                    className="p-2.5 rounded-xl hover:bg-surface border border-border-subtle hover:border-border-custom text-left flex items-center gap-3 group transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border-subtle">
                      <BarChart3 className="w-4 h-4 text-text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                        Knowledge Analytics
                      </p>
                      <p className="text-[11px] text-text-muted">View telemetry &amp; growth</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Theme Switcher in Palette */}
              <div>
                <div className="text-[11px] font-semibold tracking-wider uppercase text-text-muted px-2 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-accent" />
                  Visual Theme
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {THEMES.map((theme) => {
                    const isSelected = activeTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => switchTheme(theme.id)}
                        className={`p-2 rounded-xl text-left flex items-center justify-between border transition-all ${
                          isSelected
                            ? 'bg-accent-subtle border-accent/40 text-text-primary'
                            : 'bg-surface border-border-subtle hover:border-border-custom text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <div className="truncate">
                          <p className="text-xs font-medium truncate flex items-center gap-1.5">
                            {theme.name}
                          </p>
                          <p className="text-[10px] text-text-muted truncate">{theme.desc}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border-subtle bg-surface/50 flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-border-subtle text-[10px]">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-surface px-1.5 py-0.5 rounded border border-border-subtle text-[10px]">
                ↵
              </kbd>{' '}
              Select
            </span>
          </div>
          <span className="font-mono text-[10px]">Neural Cortex 2.0</span>
        </div>
      </div>
    </div>
  );
}
