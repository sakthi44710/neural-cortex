'use client';

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMarkdownProps {
  content: string;
}

/* ── Copy button for code blocks ── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
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
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all hover:bg-white/10"
      title={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-neon-green" />
          <span className="text-neon-green">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-text-secondary" />
          <span className="text-text-secondary">Copy</span>
        </>
      )}
    </button>
  );
}

/* ── Collapsible section ── */
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="my-3 rounded-xl border border-white/10 overflow-hidden">
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
          // ── Code blocks with language tag + copy ──
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

            const language = match?.[1] || '';
            const codeString = String(children).replace(/\n$/, '');

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

          // ── Blockquote ──
          blockquote({ children }) {
            return <blockquote className="chat-blockquote">{children}</blockquote>;
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
