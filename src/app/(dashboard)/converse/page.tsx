'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Loader2, Plus, MessageSquare, Trash2, Paperclip, FileText, X, Upload, Check, Copy, RotateCcw } from 'lucide-react';
import ChatMarkdown from '@/components/shared/ChatMarkdown';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; title: string }[];
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export default function ConversePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/brain/query?list=true');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
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
    }
  };

  const newConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setShowUploadPanel(false);
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);

        const res = await fetch('/api/ingest/document', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || `Failed: ${file.name}`);
        }
      } catch (err) {
        console.error('Upload failed for', file.name, err);
      }
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (successCount > 0) {
      toast.success(`${successCount} document${successCount > 1 ? 's' : ''} uploaded & processing`);
      // Notify the user in chat
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I've ingested **${successCount} new document${successCount > 1 ? 's' : ''}** into your knowledge base. The AI is processing them now — you can ask me about them in a moment!`,
          createdAt: new Date(),
        },
      ]);
    } else {
      toast.error('Upload failed. Try .txt, .md, or .json files.');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Create placeholder assistant message for streaming
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
          message: userMessage.content,
          conversationId: currentConversationId,
          stream: true,
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        // Handle streaming response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let sources: { id: string; title: string }[] = [];
        let newConvId: string | null = null;

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
                }
              } catch {}
            }
          }
        }

        // Update with final sources
        if (sources.length > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, sources } : m
            )
          );
        }

        if (newConvId && !currentConversationId) {
          setCurrentConversationId(newConvId);
          fetchConversations();
        }
      } else {
        // Fallback: non-streaming JSON response
        const data = await res.json();

        if (data.conversationId && !currentConversationId) {
          setCurrentConversationId(data.conversationId);
          fetchConversations();
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: data.response || 'Sorry, I could not generate a response.',
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
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
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

  const suggestedPrompts = [
    'Summarize my recent documents',
    'What are the key themes in my knowledge base?',
    'Find connections between my documents',
    'What knowledge gaps do I have?',
  ];

  return (
    <div className="flex h-[calc(100vh-7rem)] max-w-7xl mx-auto gap-4">
      {/* Conversation List */}
      <div className="w-72 shrink-0 rounded-2xl glass overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-custom">
          <button
            onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border border-neon-blue/30 hover:border-neon-blue/60 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`group w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer flex items-center justify-between ${
                currentConversationId === conv.id
                  ? 'bg-white/10 text-white'
                  : 'text-text-secondary hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">{conv.title}</span>
              </div>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-all shrink-0 ml-1"
                title="Delete conversation"
              >
                {deletingId === conv.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-text-secondary text-xs text-center py-4">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col rounded-2xl glass overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold mb-2">Neural Cortex AI</h2>
              <p className="text-text-secondary mb-8 max-w-md">
                Ask me anything about your knowledge base. I can recall, connect, and generate
                insights from your documents.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className="p-3 rounded-xl glass text-sm text-left text-text-secondary hover:text-white hover:bg-white/5 transition-all"
                  >
                    <Sparkles className="w-4 h-4 mb-1.5 text-neon-purple" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`group/msg relative ${
                    msg.role === 'user'
                      ? 'max-w-[75%] bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 border border-neon-blue/20 rounded-2xl rounded-br-md px-4 py-3'
                      : 'max-w-[85%] bg-white/[0.03] rounded-2xl rounded-bl-md px-4 py-3'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <>
                      {msg.content ? (
                        <ChatMarkdown content={msg.content} />
                      ) : (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 className="w-4 h-4 animate-spin text-neon-blue" />
                          <span className="text-sm text-text-secondary">Thinking...</span>
                        </div>
                      )}
                      {/* Action buttons — visible on hover */}
                      {msg.content && (
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(msg.content);
                              toast.success('Copied to clipboard');
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-secondary hover:text-white hover:bg-white/10 transition-all"
                            title="Copy response"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-text-secondary mb-1.5 font-medium uppercase tracking-wider">Sources</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((source, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-neon-blue/10 text-neon-blue border border-neon-blue/15"
                          >
                            <FileText className="w-3 h-3" />
                            {source.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-pink to-rose-500 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Upload Panel */}
        <AnimatePresence>
          {showUploadPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border-custom overflow-hidden"
            >
              <div className="p-4 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Upload className="w-4 h-4 text-neon-blue" />
                    Upload Document to Knowledge Base
                  </h4>
                  <button
                    onClick={() => setShowUploadPanel(false)}
                    className="p-1 rounded-lg hover:bg-white/10 text-text-secondary hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 hover:border-neon-blue/40 rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-white/[0.02]"
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 text-text-secondary" />
                  <p className="text-sm text-text-secondary">Click to select files</p>
                  <p className="text-xs text-text-secondary/60 mt-1">.docx, .pdf, .pptx, .txt, .md, .json, .csv supported</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.json,.csv,.text,.markdown,.docx,.pdf,.pptx"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Uploading indicator */}
        {isUploading && (
          <div className="px-4 py-2 border-t border-border-custom flex items-center gap-2 text-sm text-neon-blue">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading & processing document...
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border-custom">
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              disabled={isUploading}
              className={`p-3 rounded-xl border transition-all shrink-0 ${
                showUploadPanel
                  ? 'bg-neon-blue/20 border-neon-blue/40 text-neon-blue'
                  : 'border-white/10 text-text-secondary hover:text-white hover:border-white/20 hover:bg-white/5'
              } disabled:opacity-50`}
              title="Upload document"
            >
              <Plus className="w-5 h-5" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your knowledge twin..."
              rows={1}
              className="flex-1 input-dark resize-none min-h-[44px] max-h-[120px] py-3"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="p-3 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-2 text-center">
            Neural Cortex uses NVIDIA AI &#x2022; Responses based on your knowledge base
          </p>
        </div>
      </div>
    </div>
  );
}
