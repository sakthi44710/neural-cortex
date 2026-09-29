'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import {
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Code,
  Eye,
  Maximize2,
  Minimize2,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Download,
} from 'lucide-react';

interface ChatMarkdownProps {
  content: string;
}

import DOMPurify from 'dompurify';

// Ensure DOMPurify has required hooks and sanitize methods in Next.js browser context
if (typeof window !== 'undefined') {
  try {
    if (typeof DOMPurify === 'function') {
      const instance = (DOMPurify as any)(window);
      if (instance) {
        Object.assign(DOMPurify, instance);
      }
    }
  } catch (e) {
    console.warn('DOMPurify window binding note:', e);
  }

  if (typeof (DOMPurify as any).addHook !== 'function') {
    (DOMPurify as any).addHook = () => {};
    (DOMPurify as any).removeHook = () => {};
    (DOMPurify as any).removeHooks = () => {};
    (DOMPurify as any).removeAllHooks = () => {};
  }
  if (typeof (DOMPurify as any).sanitize !== 'function') {
    (DOMPurify as any).sanitize = (txt: string) => txt;
  }
  (window as any).DOMPurify = DOMPurify;

  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      suppressErrorRendering: true,
      logLevel: 'error',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      themeVariables: {
        darkMode: true,
        background: '#090d16',
        primaryColor: '#1e293b',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#38bdf8',
        lineColor: '#38bdf8',
        secondaryColor: '#3b82f6',
        tertiaryColor: '#1e1b4b',
        mainBkg: '#0f172a',
        nodeBorder: '#38bdf8',
        clusterBkg: 'rgba(255, 255, 255, 0.04)',
        clusterBorder: 'rgba(56, 189, 248, 0.3)',
        titleColor: '#38bdf8',
        edgeLabelBackground: '#0b1120',
        nodeTextColor: '#f8fafc',
      },
    });
  } catch (e) {
    console.error('Mermaid initialization failed:', e);
  }
}

// Helper to remove any orphan error elements that Mermaid appends to document.body
function cleanupMermaidArtifacts() {
  if (typeof document === 'undefined') return;
  try {
    const stray = document.querySelectorAll(
      'body > .error-icon, body > .error-text, body > [aria-roledescription="error"]'
    );
    stray.forEach((el) => {
      try {
        el.remove();
      } catch {}
    });
  } catch {}
}

// Sanitize Mermaid code to fix common LLM formatting issues
function sanitizeMermaid(raw: string): string {
  if (!raw) return '';
  let code = raw.trim();

  // Strip code block markdown fences
  code = code
    .replace(/^```(?:mermaid)?\s*/i, '')
    .replace(/```$/g, '')
    .trim();

  // Decode common HTML entities
  code = code
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  // Fix unquoted node labels with special characters like ( ) / & : # @
  // Only target standard rectangle nodes: e.g. A[User Request (SQL)] -> A["User Request (SQL)"]
  // Do NOT touch cylinder [( ... )] or stadium ([ ... ]) or subroutine [[ ... ]]
  code = code.replace(/(?<![\(\[])\[\s*([^"\]\r\n\(\)]*?[\(\)\/&:#@][^"\]\r\n]*?)\s*\](?![\)\]])/g, (match, inner) => {
    const trimmed = inner.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return match;
    }
    const safeInner = trimmed.replace(/"/g, "'");
    return `["${safeInner}"]`;
  });

  return code;
}

/* ── Copy button ── */
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:bg-white/10 text-text-secondary hover:text-white"
      title={copied ? 'Copied to clipboard' : 'Copy'}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-neon-green" />
          <span className="text-neon-green">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

/* ── Interactive Mermaid Viewer ── */
function MermaidViewer({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce chart updates by 250ms during streaming to avoid render thrashing
  const [debouncedChart, setDebouncedChart] = useState(chart);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedChart(chart);
    }, 250);
    return () => clearTimeout(timer);
  }, [chart]);

  // Clean stray error elements on mount and unmount
  useEffect(() => {
    cleanupMermaidArtifacts();
    return () => {
      cleanupMermaidArtifacts();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsRendering(true);
    setError(null);

    const renderChart = async () => {
      try {
        const sanitized = sanitizeMermaid(debouncedChart);
        if (!sanitized) {
          if (isMounted) setIsRendering(false);
          return;
        }

        if (typeof (DOMPurify as any).addHook !== 'function') {
          (DOMPurify as any).addHook = () => {};
          (DOMPurify as any).removeHook = () => {};
          (DOMPurify as any).removeHooks = () => {};
          (DOMPurify as any).removeAllHooks = () => {};
        }
        if (typeof (DOMPurify as any).sanitize !== 'function') {
          (DOMPurify as any).sanitize = (txt: string) => txt;
        }

        // Dedicated hidden offscreen container for Mermaid to safely render inside
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.visibility = 'hidden';
        document.body.appendChild(container);

        try {
          const id = `mm_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
          const { svg: renderedSvg } = await mermaid.render(id, sanitized, container);
          if (isMounted) {
            setSvg(renderedSvg);
            setError(null);
          }
        } finally {
          container.remove();
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Mermaid rendering error:', err);
          setError(err?.message || 'Syntax error in Mermaid diagram');
        }
      } finally {
        cleanupMermaidArtifacts();
        if (isMounted) {
          setIsRendering(false);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
      cleanupMermaidArtifacts();
    };
  }, [debouncedChart]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleDownloadSVG = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [svg]);

  const zoomIn = () => setZoom((z) => Math.min(Number((z + 0.15).toFixed(2)), 2.5));
  const zoomOut = () => setZoom((z) => Math.max(Number((z - 0.15).toFixed(2)), 0.5));
  const resetZoom = () => setZoom(1);

  return (
    <>
      <div className="my-4 rounded-2xl border border-neon-blue/30 bg-[#070b14]/90 overflow-hidden shadow-2xl transition-all">
        {/* Diagram Header / Toolbar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neon-blue/15 text-neon-blue text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3 h-3" />
              Interactive Diagram
            </span>
            {error && (
              <span className="text-xs text-amber-400 font-medium">Syntax Preview</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10 mr-1">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                  viewMode === 'preview'
                    ? 'bg-neon-blue/20 text-neon-blue font-medium'
                    : 'text-text-secondary hover:text-white'
                }`}
                title="Visual Preview"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Visual</span>
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                  viewMode === 'code'
                    ? 'bg-neon-purple/20 text-neon-purple font-medium'
                    : 'text-text-secondary hover:text-white'
                }`}
                title="Mermaid Code"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>
            </div>

            {viewMode === 'preview' && !error && svg && (
              <>
                <button
                  onClick={zoomOut}
                  className="p-1.5 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-text-secondary px-1 min-w-[36px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1.5 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  className="p-1.5 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDownloadSVG}
                  className="p-1.5 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                  title="Download SVG"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-1.5 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <CopyButton text={chart} label="Copy" />
          </div>
        </div>

        {/* Diagram Body */}
        <div className="relative p-4 overflow-auto min-h-[140px] flex items-center justify-center bg-[#070b14]/50">
          {viewMode === 'preview' ? (
            isRendering ? (
              <div className="flex items-center gap-2.5 py-8 text-sm text-text-secondary">
                <div className="w-4 h-4 rounded-full border-2 border-neon-blue border-t-transparent animate-spin" />
                <span>Generating diagram visualization...</span>
              </div>
            ) : error ? (
              <div className="w-full">
                <div className="mb-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Unable to render graphical preview. Showing syntax below:</span>
                </div>
                <pre className="p-3 rounded-xl bg-black/60 font-mono text-xs text-neon-blue overflow-x-auto">
                  <code>{chart}</code>
                </pre>
              </div>
            ) : (
              <div
                ref={containerRef}
                className="w-full flex justify-center transition-transform duration-150 origin-center"
                style={{ transform: `scale(${zoom})` }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )
          ) : (
            <div className="w-full">
              <pre className="p-4 rounded-xl bg-black/70 font-mono text-xs text-text-secondary overflow-x-auto border border-white/5">
                <code className="language-mermaid">{chart}</code>
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal View */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col p-6 animate-fadeIn">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neon-blue" />
              <h3 className="text-base font-semibold text-white">Full-Screen Visual Diagram</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                className="p-2 rounded-lg text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-white px-2">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-2 rounded-lg text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className="p-2 rounded-lg text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownloadSVG}
                className="p-2 rounded-lg text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                title="Download SVG"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all ml-2"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Close (Esc)</span>
              </button>
            </div>
          </div>

          {/* Modal SVG Body */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <div
              className="max-w-full max-h-full transition-transform duration-150 origin-center"
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ── GitHub-style Alert Callout ── */
function AlertCallout({
  type,
  children,
}: {
  type: 'note' | 'tip' | 'important' | 'warning' | 'caution';
  children: React.ReactNode;
}) {
  const configs = {
    note: {
      title: 'NOTE',
      icon: Info,
      border: 'border-neon-blue/40',
      bg: 'bg-neon-blue/5',
      text: 'text-neon-blue',
      badge: 'bg-neon-blue/15 text-neon-blue',
    },
    tip: {
      title: 'TIP',
      icon: Lightbulb,
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-500/5',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-400',
    },
    important: {
      title: 'IMPORTANT',
      icon: Sparkles,
      border: 'border-neon-purple/40',
      bg: 'bg-neon-purple/5',
      text: 'text-neon-purple',
      badge: 'bg-neon-purple/15 text-neon-purple',
    },
    warning: {
      title: 'WARNING',
      icon: AlertTriangle,
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/5',
      text: 'text-amber-400',
      badge: 'bg-amber-500/15 text-amber-400',
    },
    caution: {
      title: 'CAUTION',
      icon: AlertCircle,
      border: 'border-rose-500/40',
      bg: 'bg-rose-500/5',
      text: 'text-rose-400',
      badge: 'bg-rose-500/15 text-rose-400',
    },
  };

  const config = configs[type] || configs.note;
  const Icon = config.icon;

  return (
    <div className={`my-4 rounded-xl border ${config.border} ${config.bg} p-4 text-sm shadow-lg`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${config.text}`} />
        <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${config.badge}`}>
          {config.title}
        </span>
      </div>
      <div className="text-text-primary leading-relaxed">{children}</div>
    </div>
  );
}

/* ── Collapsible section ── */
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="my-3 rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm font-medium"
      >
        <span>{title}</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
      </button>
      {isOpen && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

/* ── Main markdown renderer ── */
export default function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Code blocks with language tag, Mermaid visual rendering, and copy ──
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');

            if (isInline) {
              return (
                <code className="chat-inline-code" {...props}>
                  {children}
                </code>
              );
            }

            const language = (match?.[1] || '').toLowerCase();
            const codeString = String(children).replace(/\n$/, '');

            // Render Mermaid diagrams directly into interactive visual SVGs
            if (language === 'mermaid') {
              return <MermaidViewer chart={codeString} />;
            }

            return (
              <div className="chat-code-block group">
                <div className="chat-code-header">
                  <span className="chat-code-lang">{language || 'code'}</span>
                  <CopyButton text={codeString} />
                </div>
                <div className="chat-code-body">
                  <pre>
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              </div>
            );
          },

          // ── Pre: strip default wrapper since code() handles it ──
          pre({ children }) {
            return <>{children}</>;
          },

          // ── Blockquote: handles GitHub-style Alerts and standard quotes ──
          blockquote({ children }) {
            // Check if blockquote content is a GitHub alert: [!NOTE], [!TIP], etc.
            const textContent = React.Children.toArray(children)
              .map((c: any) => (typeof c === 'string' ? c : c?.props?.children || ''))
              .join(' ')
              .trim();

            const alertMatch = textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);

            if (alertMatch) {
              const alertType = alertMatch[1].toLowerCase() as
                | 'note'
                | 'tip'
                | 'important'
                | 'warning'
                | 'caution';

              // Filter out the alert tag from the children
              return (
                <AlertCallout type={alertType}>
                  {React.Children.map(children, (child: any) => {
                    if (typeof child === 'string') {
                      return child.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');
                    }
                    if (child?.props?.children) {
                      const childText = String(child.props.children);
                      if (childText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)) {
                        return React.cloneElement(child, {
                          children: childText.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, ''),
                        });
                      }
                    }
                    return child;
                  })}
                </AlertCallout>
              );
            }

            return <blockquote className="chat-blockquote">{children}</blockquote>;
          },

          // ── Tables with horizontal scroll + styling ──
          table({ children }) {
            return (
              <div className="chat-table-wrapper">
                <table className="chat-table">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="chat-thead">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="chat-tbody">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="chat-tr">{children}</tr>;
          },
          th({ children }) {
            return <th className="chat-th">{children}</th>;
          },
          td({ children }) {
            return <td className="chat-td">{children}</td>;
          },

          // ── Headings ──
          h1({ children }) {
            return <h1 className="chat-h1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="chat-h2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="chat-h3">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="chat-h4">{children}</h4>;
          },

          // ── Lists ──
          ul({ children }) {
            return <ul className="chat-ul">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="chat-ol">{children}</ol>;
          },
          li({ children }) {
            return <li className="chat-li">{children}</li>;
          },

          // ── Links open in new tab ──
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="chat-link"
              >
                {children}
              </a>
            );
          },

          // ── Horizontal rule ──
          hr() {
            return <hr className="chat-hr" />;
          },

          // ── Paragraph ──
          p({ children }) {
            return <p className="chat-p">{children}</p>;
          },

          // ── Strong / Em ──
          strong({ children }) {
            return <strong className="chat-strong">{children}</strong>;
          },
          em({ children }) {
            return <em className="chat-em">{children}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
