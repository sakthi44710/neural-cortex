'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Plus,
  MessageSquare,
  Trash2,
  Paperclip,
  FileText,
  X,
  Upload,
  Check,
  Copy,
  RotateCcw,
  Layers,
  Search,
  SlidersHorizontal,
  Globe,
  Brain,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Download,
  Share2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Pin,
  CheckCircle2,
  ExternalLink,
  Info
} from 'lucide-react';
import ChatMarkdown from '@/components/shared/ChatMarkdown';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { id?: string; title: string; type?: string }[];
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface DocumentContextItem {
  id: string;
  title: string;
  domain?: string;
}

function ConverseContent() {
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get('docId');
  const initialDocTitle = searchParams.get('title');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conversationSearch, setConversationSearch] = useState('');
  
  // Smart Context State
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [diagramMode, setDiagramMode] = useState<'auto' | 'always' | 'off'>('auto');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [pinnedDoc, setPinnedDoc] = useState<{ id: string; title: string } | null>(
    initialDocId && initialDocTitle ? { id: initialDocId, title: initialDocTitle } : null
  );
  const [vaultDocs, setVaultDocs] = useState<DocumentContextItem[]>([]);
  
  // Audio & Voice State
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore draft from localStorage
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('nc_converse_draft');
      if (savedDraft && !input) {
        setInput(savedDraft);
      }
    } catch {}
  }, []);

  // Fetch initial conversations and available vault docs for smart context
  useEffect(() => {
    fetchConversations();
    fetchVaultDocs();
  }, []);

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle URL search params if user navigated from Vault
  useEffect(() => {
    if (initialDocId && initialDocTitle) {
      setPinnedDoc({ id: initialDocId, title: initialDocTitle });
      if (!input.trim()) {
        const promptSeed = `Summarize and explain the key findings in "${initialDocTitle}".`;
        setInput(promptSeed);
        try {
          localStorage.setItem('nc_converse_draft', promptSeed);
        } catch {}
      }
    }
  }, [initialDocId, initialDocTitle]);

  // Setup Web Speech API for voice dictation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('');
          
          setInput((prev) => {
            const next = prev ? `${prev} ${transcript}` : transcript;
            try {
              localStorage.setItem('nc_converse_draft', next);
            } catch {}
            return next;
          });
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast('Listening...', { icon: '🎙️' });
      } catch (err) {
        console.error('Speech recognition error:', err);
      }
    }
  };

  const handleSpeak = (messageId: string, content: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown before speaking
    const cleanText = content.replace(/[*_#`~\[\]]/g, '').slice(0, 1000);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/brain/query?list=true');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchVaultDocs = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        const docs = (data.documents || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          domain: d.domain,
        }));
        setVaultDocs(docs);
      }
    } catch (e) {
      console.error('Failed to fetch documents for context:', e);
    }
  };

  const loadConversation = async (convId: string) => {
    setCurrentConversationId(convId);
    try {
      const res = await fetch(`/api/brain/query?conversationId=${convId}`);
      const data = await res.json();
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.sources ? JSON.parse(m.sources) : undefined,
          createdAt: new Date(m.createdAt),
        }))
      );
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast.error('Failed to load thread');
    }
  };

  const newConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setPinnedDoc(null);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(convId);
    try {
      const res = await fetch(`/api/brain/query?conversationId=${convId}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (currentConversationId === convId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
        toast.success('Conversation deleted');
      } else {
        toast.error('Failed to delete conversation');
      }
    } catch {
      toast.error('Failed to delete conversation');
    } finally {
      setDeletingId(null);
    }
  };

  const exportConversationMarkdown = () => {
    if (messages.length === 0) {
      toast('No messages to export', { icon: 'ℹ️' });
      return;
    }

    const currentConv = conversations.find((c) => c.id === currentConversationId);
    const title = currentConv?.title || 'Neural Cortex Conversation';

    let markdown = `# ${title}\n\n*Exported from Neural Cortex 2.0 on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

    messages.forEach((m) => {
      const roleName = m.role === 'user' ? '### 👤 User' : '### 🤖 Neural Cortex AI';
      markdown += `${roleName} *(${new Date(m.createdAt).toLocaleTimeString()})*\n\n${m.content}\n\n`;
      if (m.sources && m.sources.length > 0) {
        markdown += `**Sources:**\n` + m.sources.map((s) => `- ${s.title}`).join('\n') + '\n\n';
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Conversation exported as Markdown');
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    try {
      localStorage.setItem('nc_converse_draft', val);
    } catch {}
  };

  const sendMessage = async (overridePrompt?: string) => {
    const promptToSend = (overridePrompt || input).trim();
    if (!promptToSend || isLoading) return;

    // Prepend pinned doc instructions if active
    let formattedMessage = promptToSend;
    if (pinnedDoc && !promptToSend.includes(pinnedDoc.title)) {
      formattedMessage = `[Target Document Context: "${pinnedDoc.title}"]\n${promptToSend}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptToSend,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    try {
      localStorage.removeItem('nc_converse_draft');
    } catch {}
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      },
    ]);

    try {
      const res = await fetch('/api/brain/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: formattedMessage,
          conversationId: currentConversationId,
          stream: true,
          pinnedDocId: pinnedDoc?.id,
          webSearch: webSearchEnabled,
          diagramPreference: diagramMode,
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let sources: { id: string; title: string }[] = [];
        let newConvId: string | null = null;
        let convTitle: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullContent } : m
                    )
                  );
                }
                if (parsed.done) {
                  if (parsed.conversationId) newConvId = parsed.conversationId;
                  if (parsed.sources) sources = parsed.sources;
                  if (parsed.conversationTitle) convTitle = parsed.conversationTitle;
                }
              } catch {}
            }
          }
        }

        if (sources.length > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, sources } : m
            )
          );
        }

        const activeId = newConvId || currentConversationId;
        if (newConvId && !currentConversationId) {
          setCurrentConversationId(newConvId);
        }

        if (convTitle && activeId) {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === activeId);
            if (exists) {
              return prev.map((c) =>
                c.id === activeId ? { ...c, title: convTitle! } : c
              );
            }
            return [{ id: activeId, title: convTitle!, updatedAt: new Date().toISOString() }, ...prev];
          });
        }
        fetchConversations();
      } else {
        const data = await res.json();
        const activeId = data.conversationId || currentConversationId;

        if (data.conversationId && !currentConversationId) {
          setCurrentConversationId(data.conversationId);
        }

        if (data.conversationTitle && activeId) {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === activeId);
            if (exists) {
              return prev.map((c) =>
                c.id === activeId ? { ...c, title: data.conversationTitle } : c
              );
            }
            return [{ id: activeId, title: data.conversationTitle, updatedAt: new Date().toISOString() }, ...prev];
          });
        }
        fetchConversations();

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: data.response || 'No response was generated.',
                  sources: data.sources || [],
                }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Encountered an issue communicating with the AI. Please verify your connection and try again.' }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEditMessage = (content: string) => {
    setInput(content);
    try {
      localStorage.setItem('nc_converse_draft', content);
    } catch {}
    inputRef.current?.focus();
    toast('Prompt loaded into editor', { icon: '✏️' });
  };

  const handleRetryLast = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  };

  // Filter conversations based on sidebar search
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(conversationSearch.toLowerCase().trim())
  );

  const quickDiagramChips = [
    { label: 'System Architecture', prompt: 'Generate a clean architecture diagram for this domain and explain each core layer.' },
    { label: 'Flowchart Logic', prompt: 'Create a detailed flowchart diagram showing the process workflow, validations, and outcomes.' },
    { label: 'ER Data Model', prompt: 'Generate an Entity-Relationship (ER) diagram illustrating the data models and relationships.' },
    { label: 'Concept Mindmap', prompt: 'Create a conceptual mindmap connecting the main themes and subtopics in this area.' },
    { label: 'Compare & Contrast', prompt: 'Synthesize a comparative matrix evaluating the advantages, trade-offs, and failure modes.' },
  ];

  return (
    <div className="flex h-[calc(100vh-6.5rem)] w-full gap-4">
      {/* Conversation Thread Explorer Sidebar */}
      <div className="w-80 shrink-0 rounded-xl bg-surface border border-border-custom overflow-hidden flex flex-col shadow-sm">
        <div className="p-3 border-b border-border-custom space-y-2">
          <button
            onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-blue text-white text-xs font-medium hover:bg-slate-blue/90 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Conversation</span>
          </button>
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-elevated border border-border-custom text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-slate-blue transition-colors"
            />
            {conversationSearch && (
              <button
                onClick={() => setConversationSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.map((conv) => {
            const isSelected = currentConversationId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`group w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between border ${
                  isSelected
                    ? 'bg-slate-blue/10 text-slate-blue font-medium border-slate-blue/30 shadow-xs'
                    : 'text-text-secondary border-transparent hover:bg-surface-elevated hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-slate-blue' : 'text-text-tertiary'}`} />
                  <span className="truncate">{conv.title}</span>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-text-tertiary hover:text-red-500 transition-all shrink-0 ml-1"
                  title="Delete conversation"
                >
                  {deletingId === conv.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-text-tertiary text-xs">
                {conversationSearch ? 'No matching threads found.' : 'No conversations yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Smart Context Trigger Footer */}
        <div className="p-2.5 border-t border-border-custom bg-surface-elevated/40 flex items-center justify-between text-[11px] text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>RAG Active</span>
          </div>
          <button
            onClick={() => setShowContextDrawer(!showContextDrawer)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-elevated text-text-primary transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3 text-slate-blue" />
            <span>Context</span>
          </button>
        </div>
      </div>

      {/* Main Conversation Canvas */}
      <div className="flex-1 flex flex-col rounded-xl bg-surface border border-border-custom overflow-hidden shadow-sm relative">
        {/* Workspace Header & Telemetry */}
        <div className="px-5 py-2.5 border-b border-border-custom bg-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
              <Bot className="w-4 h-4 text-slate-blue" />
              <span>Personal Knowledge Twin</span>
            </div>
            <span className="text-border-custom">•</span>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-custom font-mono">
                Llama 3.3 70B
              </span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-surface-elevated border border-border-custom text-text-tertiary font-mono">
                temp: 0.1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {pinnedDoc && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-blue/10 border border-slate-blue/20 text-slate-blue text-xs">
                <Pin className="w-3 h-3 shrink-0" />
                <span className="max-w-[130px] truncate">{pinnedDoc.title}</span>
                <button
                  onClick={() => setPinnedDoc(null)}
                  className="hover:text-red-400 ml-1"
                  title="Unpin document"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowContextDrawer(!showContextDrawer)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                showContextDrawer
                  ? 'bg-slate-blue text-white border-slate-blue'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary border-border-custom'
              }`}
              title="Toggle Smart Context Drawer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Context</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </button>

            {messages.length > 0 && (
              <button
                onClick={exportConversationMarkdown}
                className="p-1.5 rounded-lg bg-surface-elevated border border-border-custom text-text-secondary hover:text-text-primary transition-colors"
                title="Export thread as Markdown"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Smart Context Drawer Overlay */}
        <AnimatePresence>
          {showContextDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border-custom bg-surface-elevated/70 backdrop-blur-md overflow-hidden z-20"
            >
              <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                {/* Knowledge Base Scope */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <Brain className="w-3.5 h-3.5 text-slate-blue" />
                    <span>Knowledge Vault</span>
                  </div>
                  <p className="text-text-tertiary text-[11px]">
                    {vaultDocs.length} documents indexed & available for grounded answers.
                  </p>
                  <div className="pt-1">
                    <select
                      className="w-full px-2 py-1 rounded bg-surface border border-border-custom text-xs text-text-primary focus:outline-none focus:border-slate-blue"
                      value={pinnedDoc?.id || ''}
                      onChange={(e) => {
                        const selected = vaultDocs.find((d) => d.id === e.target.value);
                        setPinnedDoc(selected ? { id: selected.id, title: selected.title } : null);
                      }}
                    >
                      <option value="">All Vault Documents (Default)</option>
                      {vaultDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Web Search Agent */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Live Web Search</span>
                  </div>
                  <p className="text-text-tertiary text-[11px]">
                    Pulls real-time sources when Vault documents lack coverage.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={webSearchEnabled}
                      onChange={(e) => setWebSearchEnabled(e.target.checked)}
                      className="rounded border-border-custom text-slate-blue focus:ring-0"
                    />
                    <span className="text-text-secondary">{webSearchEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                {/* Architecture Diagrams */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <Layers className="w-3.5 h-3.5 text-violet-500" />
                    <span>Diagrams & Visuals</span>
                  </div>
                  <p className="text-text-tertiary text-[11px]">
                    Mermaid interactive architectures & flowcharts generation.
                  </p>
                  <select
                    value={diagramMode}
                    onChange={(e: any) => setDiagramMode(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-surface border border-border-custom text-xs text-text-primary focus:outline-none focus:border-slate-blue"
                  >
                    <option value="auto">Auto-detect (Recommended)</option>
                    <option value="always">Always include diagram</option>
                    <option value="off">Off (Text only)</option>
                  </select>
                </div>

                {/* Memory & Thread State */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Cross-Chat Memory</span>
                  </div>
                  <p className="text-text-tertiary text-[11px]">
                    Recalls context and findings from previous sessions.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={memoryEnabled}
                      onChange={(e) => setMemoryEnabled(e.target.checked)}
                      className="rounded border-border-custom text-slate-blue focus:ring-0"
                    />
                    <span className="text-text-secondary">{memoryEnabled ? 'Active' : 'Muted'}</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Thread List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[380px] text-center my-auto max-w-xl mx-auto py-8">
              <div className="w-12 h-12 rounded-xl bg-slate-blue/10 border border-slate-blue/20 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-slate-blue" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-1.5">Neural Cortex Knowledge Twin</h2>
              <p className="text-text-secondary text-xs mb-6 max-w-md leading-relaxed">
                Ask anything about your personal vault. Responses are grounded in your indexed documents, cross-conversation memory, and interactive visual architecture diagrams.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                {quickDiagramChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(chip.prompt);
                      inputRef.current?.focus();
                    }}
                    className="p-3 rounded-lg bg-surface-elevated/70 border border-border-custom hover:border-slate-blue/50 hover:bg-surface-elevated transition-all group text-left"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-slate-blue" />
                      <span className="text-xs font-medium text-text-primary group-hover:text-slate-blue transition-colors">
                        {chip.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-tertiary line-clamp-1">{chip.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${!isAssistant ? 'justify-end' : ''}`}
                >
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-lg bg-slate-blue/10 border border-slate-blue/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-slate-blue" />
                    </div>
                  )}

                  <div
                    className={`group/msg relative ${
                      !isAssistant
                        ? 'max-w-[80%] bg-accent user-msg-bubble text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-sm'
                        : 'max-w-[95%] bg-surface-elevated/80 border border-border-custom rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs'
                    }`}
                  >
                    {isAssistant ? (
                      <>
                        {msg.content ? (
                          <ChatMarkdown content={msg.content} />
                        ) : (
                          <div className="flex items-center gap-2 py-1.5 text-xs text-text-secondary">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-blue" />
                            <span>Synthesizing answer from knowledge graph...</span>
                          </div>
                        )}

                        {/* Action Toolbar on hover */}
                        {msg.content && (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border-custom/50 text-[11px] text-text-tertiary">
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(msg.content);
                                toast.success('Response copied');
                              }}
                              className="flex items-center gap-1 hover:text-text-primary transition-colors"
                              title="Copy response"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </button>

                            <button
                              onClick={() => handleSpeak(msg.id, msg.content)}
                              className="flex items-center gap-1 hover:text-text-primary transition-colors"
                              title="Read aloud"
                            >
                              {speakingMessageId === msg.id ? (
                                <>
                                  <VolumeX className="w-3 h-3 text-red-400" />
                                  <span className="text-red-400">Stop</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3 h-3" />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={handleRetryLast}
                              className="flex items-center gap-1 hover:text-text-primary transition-colors ml-auto"
                              title="Regenerate this response"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Regenerate</span>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="relative">
                        <p className="text-xs whitespace-pre-wrap leading-relaxed text-white font-normal">{msg.content}</p>
                        <button
                          onClick={() => handleEditMessage(msg.content)}
                          className="absolute -left-6 top-1 opacity-0 group-hover/msg:opacity-100 p-1 text-text-tertiary hover:text-text-primary transition-opacity"
                          title="Edit prompt"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Sources section */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border-custom">
                        <p className="text-[10px] text-text-tertiary mb-1 font-semibold uppercase tracking-wider">
                          Verified Sources
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((source, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-surface border border-border-custom text-text-secondary"
                            >
                              <FileText className="w-3 h-3 text-slate-blue" />
                              <span className="truncate max-w-[200px]">{source.title}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-accent" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Diagram Prompt Bar */}
        <div className="px-4 py-2 border-t border-border-custom bg-surface-elevated/40 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] text-text-tertiary font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-slate-blue" /> Quick Prompts:
          </span>
          {quickDiagramChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(chip.prompt);
                inputRef.current?.focus();
              }}
              className="text-[11px] shrink-0 px-2.5 py-1 rounded-full bg-surface border border-border-custom text-text-secondary hover:text-text-primary hover:border-slate-blue transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Composer */}
        <div className="p-3.5 border-t border-border-custom bg-surface shrink-0">
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              className="p-2.5 rounded-lg border border-border-custom bg-surface-elevated text-text-secondary hover:text-text-primary hover:border-border-custom/80 transition-colors shrink-0"
              title="Upload document to knowledge base"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              onClick={toggleSpeechRecognition}
              className={`p-2.5 rounded-lg border transition-colors shrink-0 ${
                isListening
                  ? 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse'
                  : 'border-border-custom bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
              title={isListening ? 'Stop listening' : 'Dictate prompt (voice)'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                pinnedDoc
                  ? `Ask about "${pinnedDoc.title}"...`
                  : 'Ask your personal knowledge twin (Enter to send, Shift+Enter for newline)...'
              }
              rows={1}
              className="flex-1 resize-none min-h-[40px] max-h-[120px] py-2.5 px-3 rounded-lg bg-surface-elevated border border-border-custom text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-slate-blue transition-colors leading-relaxed"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-lg bg-slate-blue text-white disabled:opacity-40 hover:bg-slate-blue/90 transition-all shrink-0 shadow-sm"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-tertiary mt-2 px-1">
            <span>Neural Cortex 2.0 • Grounded Cognitive Model</span>
            <span className="hidden sm:inline">Draft saved automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConversePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-6.5rem)] items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-blue" />
        </div>
      }
    >
      <ConverseContent />
    </Suspense>
  );
}
