'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Trash2,
  Clock,
  Search,
  X,
  Eye,
  Brain,
  Loader2,
  ImageIcon,
  LayoutGrid,
  List as ListIcon,
  Rows,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  HelpCircle,
  Cpu,
  Layers,
  FileCode,
  Music,
  Video,
  ChevronRight,
  Filter,
  ArrowUpDown,
  RefreshCw,
  FolderOpen,
  GraduationCap,
  FileCheck2,
  CheckCircle2,
  CircleDashed,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatRelativeDate, formatBytes } from '@/lib/utils';
import ChatMarkdown from '@/components/shared/ChatMarkdown';

interface Doc {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  tags: string | null;
  keyPoints: string | null;
  entities: string | null;
  contentType: string;
  domain: string;
  createdAt: string;
  accessCount: number;
  fileUrl: string | null;
  fileType: string | null;
  fileSize: number | null;
}

type ViewMode = 'grid' | 'list' | 'compact';
type FilterTab = 'all' | 'pdf' | 'docx' | 'pptx' | 'text' | 'image' | 'audio' | 'video' | 'report';
type SortField = 'newest' | 'oldest' | 'title' | 'size' | 'domain';
type StudyTab = 'study-guide' | '2-mark' | '5-mark' | '10-mark' | 'mcq' | 'flashcards' | 'diagram';

export default function VaultPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: 'uploading' | 'extracting' | 'analyzing' | 'indexing' | 'ready';
    fileName: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortField>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Multi-selection for bulk operations
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Slide-over Workspace
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'text' | 'entities' | 'study'>('overview');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  // Single document reprocessing state
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Study Mode State
  const [studyTab, setStudyTab] = useState<StudyTab>('study-guide');
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyData, setStudyData] = useState<{
    [key in StudyTab]?: { raw?: string; data?: any; cached?: boolean; updatedAt?: string };
  }>({});
  const [mcqUserAnswers, setMcqUserAnswers] = useState<{ [qIndex: number]: string }>({});
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('nc_vault_view') as ViewMode;
      if (savedView && ['grid', 'list', 'compact'].includes(savedView)) {
        setViewMode(savedView);
      }
    } catch {
      // ignore
    }
    fetchDocuments();
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('nc_vault_view', mode);
    } catch {
      // ignore
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast.error('Unable to load documents');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    for (const file of acceptedFiles) {
      setUploading(true);
      setUploadProgress({ stage: 'uploading', fileName: file.name });

      // Simulated realistic progress updates as the server pipeline runs
      const stepTimer1 = setTimeout(() => {
        setUploadProgress({ stage: 'extracting', fileName: file.name });
      }, 1500);

      const stepTimer2 = setTimeout(() => {
        setUploadProgress({ stage: 'analyzing', fileName: file.name });
      }, 3500);

      const stepTimer3 = setTimeout(() => {
        setUploadProgress({ stage: 'indexing', fileName: file.name });
      }, 6000);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);

        const res = await fetch('/api/ingest/document', {
          method: 'POST',
          body: formData,
        });

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);

        if (res.ok) {
          setUploadProgress({ stage: 'ready', fileName: file.name });
          toast.success(`"${file.name}" indexed successfully`);
          await fetchDocuments();
          setTimeout(() => setUploadProgress(null), 3000);
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || `Failed to process ${file.name}`);
          setUploadProgress(null);
        }
      } catch (error) {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);
        toast.error(`Error uploading ${file.name}`);
        setUploadProgress(null);
      } finally {
        setUploading(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/x-m4a': ['.m4a'],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    },
  });

  const processDocument = async (docId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setProcessingId(docId);
    try {
      const res = await fetch(`/api/ingest/document?id=${docId}`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Document re-indexed with AI');
        await fetchDocuments();
        if (activeDoc?.id === docId) {
          const updated = await fetch(`/api/documents?id=${docId}&includeContent=true`);
          const data = await updated.json();
          if (data.document) setActiveDoc(data.document);
        }
      } else {
        toast.error('Reprocessing failed');
      }
    } catch {
      toast.error('Network error during reprocessing');
    } finally {
      setProcessingId(null);
    }
  };

  const deleteDocument = async (docId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to remove this document from your vault?')) return;
    try {
      const res = await fetch(`/api/documents?id=${docId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Document deleted');
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
        if (activeDoc?.id === docId) setActiveDoc(null);
      }
    } catch {
      toast.error('Failed to delete document');
    }
  };

  // Bulk actions
  const handleSelectAll = () => {
    if (selectedDocIds.length === filteredDocs.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocs.map((d) => d.id));
    }
  };

  const toggleSelectDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedDocIds.length} selected documents?`)) return;
    setBulkProcessing(true);
    let successCount = 0;
    for (const id of selectedDocIds) {
      try {
        const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
        if (res.ok) successCount++;
      } catch {
        // continue
      }
    }
    toast.success(`Deleted ${successCount} documents`);
    setSelectedDocIds([]);
    setBulkProcessing(false);
    fetchDocuments();
    if (activeDoc && selectedDocIds.includes(activeDoc.id)) setActiveDoc(null);
  };

  const handleBulkReprocess = async () => {
    setBulkProcessing(true);
    let count = 0;
    for (const id of selectedDocIds) {
      try {
        const res = await fetch(`/api/ingest/document?id=${id}`, { method: 'PATCH' });
        if (res.ok) count++;
      } catch {
        // continue
      }
    }
    toast.success(`Reprocessed ${count} documents with AI`);
    setSelectedDocIds([]);
    setBulkProcessing(false);
    fetchDocuments();
  };

  const fetchSavedStudyData = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/study?docId=${docId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.studyData) {
          setStudyData(data.studyData);
        }
      }
    } catch (err) {
      console.error('Failed to load saved study artifacts:', err);
    }
  };

  const openDocumentWorkspace = async (doc: Doc) => {
    setActiveDoc(doc);
    setWorkspaceTab('overview');
    setStudyData({});
    setMcqUserAnswers({});
    setFlashcardIndex(0);
    setFlashcardFlipped(false);

    // Pre-load all saved study artifacts from database (saves API credits!)
    fetchSavedStudyData(doc.id);

    // Fetch full content if it was loaded in light mode
    if (!doc.content || doc.content.length === 0) {
      try {
        const res = await fetch(`/api/documents?id=${doc.id}&includeContent=true`);
        const data = await res.json();
        if (data.document) {
          setActiveDoc(data.document);
        }
      } catch {
        // use existing
      }
    }
  };

  // Study Mode Generator with database caching and on-demand redefine
  const generateStudyContent = async (mode: StudyTab, isRedefine: boolean = false) => {
    if (!activeDoc) return;
    setStudyTab(mode);
    if (studyData[mode] && !isRedefine) return; // already loaded/cached, avoid re-running API call

    setStudyLoading(true);
    try {
      const res = await fetch('/api/documents/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: activeDoc.id, mode, redefine: isRedefine }),
      });
      const data = await res.json();
      if (res.ok) {
        setStudyData((prev) => ({
          ...prev,
          [mode]: { raw: data.raw, data: data.data, cached: data.cached, updatedAt: data.updatedAt },
        }));
        if (isRedefine) {
          toast.success(`Redefined ${mode} content with fresh AI analysis`);
        } else if (data.cached) {
          toast(`Loaded saved ${mode} from Vault`, { icon: '📂' });
        }
      } else {
        toast.error(data.error || 'Failed to generate study artifact');
      }
    } catch {
      toast.error('Network error generating study content');
    } finally {
      setStudyLoading(false);
    }
  };

  // Helper checkers
  const isImageFile = (type: string | null, title?: string) => {
    if (!type && !title) return false;
    const ext = title?.split('.').pop()?.toLowerCase() || '';
    return (
      type?.startsWith('image/') ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(type || '')
    );
  };

  const isAudioFile = (type: string | null, title?: string) => {
    const ext = title?.split('.').pop()?.toLowerCase() || '';
    return type?.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg'].includes(ext);
  };

  const isVideoFile = (type: string | null, title?: string) => {
    const ext = title?.split('.').pop()?.toLowerCase() || '';
    return type?.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
  };

  const getDocTypeCategory = (doc: Doc): FilterTab => {
    const ext = doc.title.split('.').pop()?.toLowerCase() || '';
    if (doc.contentType === 'research_report') return 'report';
    if (ext === 'pdf' || doc.fileType === 'application/pdf') return 'pdf';
    if (ext === 'docx' || doc.fileType?.includes('word')) return 'docx';
    if (ext === 'pptx' || doc.fileType?.includes('presentation')) return 'pptx';
    if (['txt', 'md', 'markdown', 'json', 'csv'].includes(ext)) return 'text';
    if (isImageFile(doc.fileType, doc.title)) return 'image';
    if (isAudioFile(doc.fileType, doc.title)) return 'audio';
    if (isVideoFile(doc.fileType, doc.title)) return 'video';
    return 'text';
  };

  const getFileBadge = (doc: Doc) => {
    const ext = doc.title.split('.').pop()?.toUpperCase() || 'DOC';
    if (doc.contentType === 'research_report') return { label: 'REPORT', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (ext === 'PDF') return { label: 'PDF', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    if (ext === 'DOCX') return { label: 'DOCX', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    if (ext === 'PPTX') return { label: 'PPTX', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    if (isImageFile(doc.fileType, doc.title)) return { label: 'IMAGE', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
    if (isAudioFile(doc.fileType, doc.title)) return { label: 'AUDIO', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' };
    if (isVideoFile(doc.fileType, doc.title)) return { label: 'VIDEO', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    return { label: ext || 'TXT', color: 'bg-slate-500/10 text-slate-300 border-slate-500/20' };
  };

  const parseJsonArray = (str: string | null): string[] => {
    try {
      return JSON.parse(str || '[]');
    } catch {
      return [];
    }
  };

  // Filtered & Sorted documents
  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        // Tab filtering
        if (filterTab !== 'all') {
          const category = getDocTypeCategory(doc);
          if (category !== filterTab) return false;
        }

        // Search filtering
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = doc.title.toLowerCase().includes(q);
          const matchSummary = doc.summary?.toLowerCase().includes(q);
          const matchDomain = doc.domain?.toLowerCase().includes(q);
          const matchContent = doc.content?.toLowerCase().includes(q);
          const matchTags = doc.tags?.toLowerCase().includes(q);
          return matchTitle || matchSummary || matchDomain || matchContent || matchTags;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'size') return (b.fileSize || 0) - (a.fileSize || 0);
        if (sortBy === 'domain') return (a.domain || '').localeCompare(b.domain || '');
        return 0;
      });
  }, [documents, filterTab, searchQuery, sortBy]);

  // Aggregate stats
  const totalBytes = useMemo(() => {
    return documents.reduce((sum, d) => sum + (d.fileSize || (d.content ? d.content.length : 0)), 0);
  }, [documents]);

  const totalEntities = useMemo(() => {
    return documents.reduce((sum, d) => sum + parseJsonArray(d.entities).length, 0);
  }, [documents]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Vault Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Knowledge Vault 2.0</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
              {documents.length} Assets Indexed
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Personal knowledge ingestion center, multi-format neural extraction, and document intelligence.
          </p>
        </div>

        {/* Global Stats Counter */}
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] bg-[var(--surface)] px-4 py-2 rounded-xl border border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span><strong className="text-[var(--text-primary)]">{documents.length}</strong> Files</span>
          </div>
          <span className="text-[var(--border)]">|</span>
          <div className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span><strong className="text-[var(--text-primary)]">{formatBytes(totalBytes)}</strong> Ingested</span>
          </div>
          <span className="text-[var(--border)]">|</span>
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span><strong className="text-[var(--text-primary)]">{totalEntities}</strong> Concepts</span>
          </div>
        </div>
      </div>

      {/* Ingestion Dropzone & Real-Time Pipeline Tracker */}
      <div className="space-y-3">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)] hover:border-[var(--accent)]/60 bg-[var(--surface)] hover:bg-[var(--surface-elevated)]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {isDragActive ? 'Drop documents to begin ingestion...' : 'Drop documents here or click to browse'}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                PDF, Word (.docx), PowerPoint (.pptx), Markdown, TXT, JSON, CSV, Audio (MP3/WAV), Images, & Video
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Ingestion Stepper Banner */}
        <AnimatePresence>
          {uploadProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                  Ingesting: <span className="font-mono text-[var(--accent)]">{uploadProgress.fileName}</span>
                </span>
                <span className="text-[var(--text-secondary)] capitalize">{uploadProgress.stage}</span>
              </div>

              {/* 5-Stage Stepper */}
              <div className="grid grid-cols-5 gap-2 text-xs">
                {[
                  { stage: 'uploading', label: '1. Validation' },
                  { stage: 'extracting', label: '2. Extraction' },
                  { stage: 'analyzing', label: '3. Concepts' },
                  { stage: 'indexing', label: '4. Embedding' },
                  { stage: 'ready', label: '5. Ready' },
                ].map((step, idx) => {
                  const stages = ['uploading', 'extracting', 'analyzing', 'indexing', 'ready'];
                  const currentIndex = stages.indexOf(uploadProgress.stage);
                  const stepIndex = stages.indexOf(step.stage);
                  const isDone = stepIndex < currentIndex;
                  const isCurrent = stepIndex === currentIndex;

                  return (
                    <div
                      key={step.stage}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isDone
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : isCurrent
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-semibold animate-pulse'
                          : 'border-[var(--border)] text-[var(--text-secondary)] opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {isDone ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : isCurrent ? (
                          <CircleDashed className="w-3 h-3 animate-spin text-[var(--accent)]" />
                        ) : null}
                        <span>{step.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Bar: Search, Category Filters, Sort, View Modes */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search filename, content, topics, or concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="bg-transparent text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-[var(--surface)] text-[var(--text-primary)]">Newest First</option>
                <option value="oldest" className="bg-[var(--surface)] text-[var(--text-primary)]">Oldest First</option>
                <option value="title" className="bg-[var(--surface)] text-[var(--text-primary)]">Title (A-Z)</option>
                <option value="size" className="bg-[var(--surface)] text-[var(--text-primary)]">File Size</option>
                <option value="domain" className="bg-[var(--surface)] text-[var(--text-primary)]">Domain</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl bg-[var(--surface)] border border-[var(--border)] p-0.5">
              <button
                onClick={() => changeViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-[var(--surface-elevated)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => changeViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-[var(--surface-elevated)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="List View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => changeViewMode('compact')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'compact' ? 'bg-[var(--surface-elevated)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Compact Rows"
              >
                <Rows className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchDocuments}
              className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors"
              title="Refresh Vault"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--accent)]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Files', count: documents.length },
            { id: 'pdf', label: 'PDF', count: documents.filter((d) => getDocTypeCategory(d) === 'pdf').length },
            { id: 'docx', label: 'DOCX', count: documents.filter((d) => getDocTypeCategory(d) === 'docx').length },
            { id: 'pptx', label: 'PPTX', count: documents.filter((d) => getDocTypeCategory(d) === 'pptx').length },
            { id: 'text', label: 'Notes & MD', count: documents.filter((d) => getDocTypeCategory(d) === 'text').length },
            { id: 'image', label: 'Visuals', count: documents.filter((d) => getDocTypeCategory(d) === 'image').length },
            { id: 'audio', label: 'Audio', count: documents.filter((d) => getDocTypeCategory(d) === 'audio').length },
            { id: 'video', label: 'Video', count: documents.filter((d) => getDocTypeCategory(d) === 'video').length },
            { id: 'report', label: 'Research', count: documents.filter((d) => getDocTypeCategory(d) === 'report').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as FilterTab)}
              className={`px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterTab === tab.id
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filterTab === tab.id ? 'bg-white/20 text-white' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedDocIds.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--accent)]/30 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-primary)]">
              {selectedDocIds.length} document{selectedDocIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedDocIds([])}
              className="text-[var(--text-secondary)] hover:underline ml-2"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkReprocess}
              disabled={bulkProcessing}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-primary)] flex items-center gap-1.5"
            >
              <Brain className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Reprocess Selected</span>
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkProcessing}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Document Content by ViewMode */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse p-5 space-y-3">
              <div className="h-5 w-2/3 bg-[var(--surface-elevated)] rounded-md" />
              <div className="h-3 w-1/3 bg-[var(--surface-elevated)] rounded-md" />
              <div className="h-16 w-full bg-[var(--surface-elevated)] rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-20 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-[var(--text-secondary)] opacity-40" />
          <h3 className="text-base font-semibold text-[var(--text-primary)]">No documents found</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No assets matched "${searchQuery}". Try a different keyword or reset filters.`
              : 'Your knowledge vault is empty. Drop PDF, DOCX, PPTX, or notes above to build your Cortex brain.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredDocs.map((doc) => {
              const badge = getFileBadge(doc);
              const isSelected = selectedDocIds.includes(doc.id);
              const entities = parseJsonArray(doc.entities);

              return (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => openDocumentWorkspace(doc)}
                  className={`p-5 rounded-2xl bg-[var(--surface)] border transition-all duration-200 cursor-pointer group relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-[var(--accent)] ring-1 ring-[var(--accent)] bg-[var(--surface-elevated)]'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          onClick={(e) => toggleSelectDoc(doc.id, e)}
                          className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                        />
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${badge.color}`}>
                          {badge.label}
                        </span>
                        <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate" title={doc.title}>
                          {doc.title}
                        </h3>
                      </div>

                      {/* Quick Actions Menu */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => processDocument(doc.id, e)}
                          disabled={processingId === doc.id}
                          className="p-1 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
                          title="Reprocess with AI"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${processingId === doc.id ? 'animate-spin text-[var(--accent)]' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => deleteDocument(doc.id, e)}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Summary / Snippet */}
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-3 mb-4 leading-relaxed">
                      {doc.summary || doc.content || 'Processing document content...'}
                    </p>
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-3 border-t border-[var(--border)]/60 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2">
                      <span>{formatBytes(doc.fileSize || doc.content?.length || 0)}</span>
                      <span>&bull;</span>
                      <span>{formatRelativeDate(doc.createdAt)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {entities.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[10px]">
                          {entities.length} concepts
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.length > 0 && selectedDocIds.length === filteredDocs.length}
                    onChange={handleSelectAll}
                    className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3">Document Title</th>
                <th className="p-3 w-24">Type</th>
                <th className="p-3 w-32">Domain</th>
                <th className="p-3 w-24">Size</th>
                <th className="p-3 w-28">Created</th>
                <th className="p-3 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
              {filteredDocs.map((doc) => {
                const badge = getFileBadge(doc);
                const isSelected = selectedDocIds.includes(doc.id);

                return (
                  <tr
                    key={doc.id}
                    onClick={() => openDocumentWorkspace(doc)}
                    className={`hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors ${
                      isSelected ? 'bg-[var(--accent)]/5' : ''
                    }`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => toggleSelectDoc(doc.id, e)}
                        className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                        <span className="truncate max-w-md">{doc.title}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--text-secondary)] truncate">{doc.domain || 'General'}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{formatBytes(doc.fileSize || doc.content?.length || 0)}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{formatRelativeDate(doc.createdAt)}</td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => processDocument(doc.id, e)}
                          className="p-1 rounded hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
                          title="Reprocess"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${processingId === doc.id ? 'animate-spin text-[var(--accent)]' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => deleteDocument(doc.id, e)}
                          className="p-1 rounded hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* COMPACT VIEW */
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {filteredDocs.map((doc) => {
            const badge = getFileBadge(doc);
            const isSelected = selectedDocIds.includes(doc.id);

            return (
              <div
                key={doc.id}
                onClick={() => openDocumentWorkspace(doc)}
                className={`p-2.5 px-4 flex items-center justify-between gap-4 hover:bg-[var(--surface-elevated)] cursor-pointer text-xs transition-colors ${
                  isSelected ? 'bg-[var(--accent)]/5' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={(e) => toggleSelectDoc(doc.id, e)}
                    className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                  />
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <span className="font-medium text-[var(--text-primary)] truncate">{doc.title}</span>
                </div>

                <div className="flex items-center gap-4 text-[var(--text-secondary)] shrink-0 text-[11px]">
                  <span>{formatBytes(doc.fileSize || doc.content?.length || 0)}</span>
                  <span>{formatRelativeDate(doc.createdAt)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-Over Document Workspace (Drawer / Modal) */}
      <AnimatePresence>
        {activeDoc && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-4xl h-full bg-[var(--surface)] border-l border-[var(--border)] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Workspace Header */}
              <div className="p-5 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-[var(--text-secondary)]">Vault Workspace /</span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-semibold border ${getFileBadge(activeDoc).color}`}>
                        {getFileBadge(activeDoc).label}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">&bull; {formatBytes(activeDoc.fileSize || activeDoc.content?.length || 0)}</span>
                    </div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">{activeDoc.title}</h2>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/converse?docId=${activeDoc.id}&title=${encodeURIComponent(activeDoc.title)}`)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>Ask in Converse</span>
                    </button>
                    {activeDoc.fileUrl && (
                      <a
                        href={activeDoc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title="Download / View File"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => setActiveDoc(null)}
                      className="p-2 rounded-xl hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Workspace Tabs */}
                <div className="flex items-center gap-2 mt-4 text-xs">
                  {[
                    { id: 'overview', label: 'Overview & Visuals', icon: Eye },
                    { id: 'text', label: 'Extracted Content', icon: FileText },
                    { id: 'entities', label: 'Concepts & Graph', icon: Cpu },
                    { id: 'study', label: 'Study Mode & Revision', icon: GraduationCap },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setWorkspaceTab(tab.id as any)}
                        className={`px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-all ${
                          workspaceTab === tab.id
                            ? 'bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)]/40 shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Workspace Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {workspaceTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Visual Media Preview if Image/Video */}
                    {isImageFile(activeDoc.fileType, activeDoc.title) && activeDoc.fileUrl && (
                      <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                          Visual Diagram / Image
                        </h4>
                        <img
                          src={activeDoc.fileUrl}
                          alt={activeDoc.title}
                          className="max-h-96 w-auto rounded-xl mx-auto border border-[var(--border)] object-contain"
                        />
                      </div>
                    )}

                    {/* AI Executive Summary */}
                    {activeDoc.summary && (
                      <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI Synthesis Summary</span>
                        </div>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{activeDoc.summary}</p>
                      </div>
                    )}

                    {/* Key Conceptual Points */}
                    {activeDoc.keyPoints && parseJsonArray(activeDoc.keyPoints).length > 0 && (
                      <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3">
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                          Key Architectural Takeaways
                        </h4>
                        <ul className="space-y-2">
                          {parseJsonArray(activeDoc.keyPoints).map((pt, i) => (
                            <li key={i} className="text-xs text-[var(--text-primary)] flex items-start gap-2">
                              <span className="text-[var(--accent)] font-bold mt-0.5">&bull;</span>
                              <span className="leading-relaxed">{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Metadata Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                        <p className="text-[var(--text-secondary)]">Domain</p>
                        <p className="font-semibold text-[var(--text-primary)] mt-1">{activeDoc.domain || 'General'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                        <p className="text-[var(--text-secondary)]">Content Type</p>
                        <p className="font-semibold text-[var(--text-primary)] mt-1 capitalize">{activeDoc.contentType || 'document'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                        <p className="text-[var(--text-secondary)]">Size</p>
                        <p className="font-semibold text-[var(--text-primary)] mt-1">{formatBytes(activeDoc.fileSize || activeDoc.content?.length || 0)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                        <p className="text-[var(--text-secondary)]">Ingested Date</p>
                        <p className="font-semibold text-[var(--text-primary)] mt-1">{new Date(activeDoc.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {workspaceTab === 'text' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        <input
                          type="text"
                          placeholder="Search in extracted content..."
                          value={docSearchQuery}
                          onChange={(e) => setDocSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-4 py-1.5 text-xs rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeDoc.content);
                          setCopiedText(true);
                          setTimeout(() => setCopiedText(false), 2000);
                          toast.success('Extracted content copied to clipboard');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied' : 'Copy All'}</span>
                      </button>
                    </div>

                    <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] max-h-[500px] overflow-y-auto">
                      <ChatMarkdown content={activeDoc.content} />
                    </div>
                  </div>
                )}

                {workspaceTab === 'entities' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                        Extracted Knowledge Nodes & Entities ({parseJsonArray(activeDoc.entities).length})
                      </h4>
                      {parseJsonArray(activeDoc.entities).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parseJsonArray(activeDoc.entities).map((entity, i) => (
                            <div
                              key={i}
                              className="px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[var(--accent)]/50 text-xs text-[var(--text-primary)] flex items-center gap-2 cursor-pointer transition-all"
                              onClick={() => router.push(`/studio?search=${encodeURIComponent(entity)}`)}
                              title="Explore concept in Knowledge Studio"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                              <span>{entity}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--text-secondary)]">No specific named entities extracted yet.</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                        Taxonomy Tags
                      </h4>
                      {parseJsonArray(activeDoc.tags).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parseJsonArray(activeDoc.tags).map((tag, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 text-xs font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--text-secondary)]">No tags assigned.</p>
                      )}
                    </div>
                  </div>
                )}

                {workspaceTab === 'study' && (
                  <div className="space-y-6">
                    {/* Study Mode Selector */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
                      {[
                        { id: 'study-guide', label: 'Study Guide', icon: BookOpen },
                        { id: '2-mark', label: '2-Mark Q&A', icon: HelpCircle },
                        { id: '5-mark', label: '5-Mark Q&A', icon: Layers },
                        { id: '10-mark', label: '10-Mark Q&A', icon: Award },
                        { id: 'mcq', label: 'MCQ Quiz', icon: CheckCircle2 },
                        { id: 'flashcards', label: 'Flashcards', icon: Cpu },
                        { id: 'diagram', label: 'Architecture', icon: FileCode },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isCurrent = studyTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => generateStudyContent(item.id as StudyTab)}
                            className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold shadow-sm'
                                : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="truncate text-[11px]">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Saved Status & Redefine Action Bar */}
                    {studyData[studyTab] && !studyLoading && (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[var(--text-primary)] capitalize">
                            {studyTab.replace('-', ' ')}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Saved to Vault
                          </span>
                          {studyData[studyTab]?.updatedAt && (
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              (Saved {new Date(studyData[studyTab]!.updatedAt!).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => generateStudyContent(studyTab, true)}
                          disabled={studyLoading}
                          className="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 hover:border-[var(--accent)] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                          title="Re-run AI generation with fresh reasoning and update saved vault material"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${studyLoading ? 'animate-spin' : ''}`} />
                          <span>Redefine Content</span>
                        </button>
                      </div>
                    )}

                    {/* Study Mode Content Output */}
                    <div className="p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] min-h-[300px]">
                      {studyLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                          <p className="text-xs text-[var(--text-secondary)]">
                            Generating grounded <strong className="text-[var(--text-primary)]">{studyTab}</strong> using NVIDIA NIM...
                          </p>
                        </div>
                      ) : !studyData[studyTab] ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                          <GraduationCap className="w-10 h-10 text-[var(--text-secondary)] opacity-40" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">Ready to generate {studyTab}</p>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                              Click any study tool above to synthesize verified revision material from this document.
                            </p>
                          </div>
                          <button
                            onClick={() => generateStudyContent(studyTab)}
                            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
                          >
                            Generate {studyTab} Now
                          </button>
                        </div>
                      ) : studyTab === 'mcq' && Array.isArray(studyData[studyTab]?.data) ? (
                        /* Interactive MCQ Component */
                        <div className="space-y-6">
                          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                              5 Grounded Multiple Choice Questions
                            </h3>
                            <button
                              onClick={() => generateStudyContent('mcq', true)}
                              disabled={studyLoading}
                              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1.5 disabled:opacity-50 font-medium"
                              title="Redefine MCQs with fresh questions"
                            >
                              <RefreshCw className={`w-3 h-3 ${studyLoading ? 'animate-spin' : ''}`} /> Redefine MCQs
                            </button>
                          </div>

                          {studyData[studyTab]?.data.map((q: any, qIdx: number) => {
                            const userAnswer = mcqUserAnswers[qIdx];
                            const isAnswered = !!userAnswer;

                            return (
                              <div key={qIdx} className="space-y-3 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                                <p className="text-xs font-semibold text-[var(--text-primary)]">
                                  {qIdx + 1}. {q.question}
                                </p>
                                <div className="space-y-2">
                                  {q.options.map((opt: string, optIdx: number) => {
                                    const isCorrect = opt.trim() === q.answer.trim();
                                    const isSelected = userAnswer === opt;

                                    return (
                                      <button
                                        key={optIdx}
                                        onClick={() =>
                                          setMcqUserAnswers((prev) => ({ ...prev, [qIdx]: opt }))
                                        }
                                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border flex items-center justify-between ${
                                          !isAnswered
                                            ? 'border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--accent)]/40 text-[var(--text-primary)]'
                                            : isCorrect
                                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-medium'
                                            : isSelected
                                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                                            : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] opacity-60'
                                        }`}
                                      >
                                        <span>{opt}</span>
                                        {isAnswered && isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                      </button>
                                    );
                                  })}
                                </div>
                                {isAnswered && q.explanation && (
                                  <div className="p-3 rounded-lg bg-[var(--surface-elevated)] text-xs text-[var(--text-secondary)] border-l-2 border-[var(--accent)]">
                                    <strong className="text-[var(--text-primary)]">Explanation: </strong>
                                    {q.explanation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : studyTab === 'flashcards' && Array.isArray(studyData[studyTab]?.data) ? (
                        /* Interactive 3D Flip Flashcards */
                        <div className="space-y-6 flex flex-col items-center">
                          <div className="w-full flex items-center justify-between pb-3 border-b border-[var(--border)]">
                            <span className="text-xs text-[var(--text-secondary)]">
                              Card {flashcardIndex + 1} of {studyData[studyTab]?.data.length}
                            </span>
                            <span className="text-xs text-[var(--accent)]">Click card to flip</span>
                          </div>

                          {studyData[studyTab]?.data[flashcardIndex] && (
                            <div
                              onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                              className="w-full max-w-md h-64 rounded-2xl bg-[var(--surface)] border border-[var(--accent)]/40 p-6 flex flex-col items-center justify-center text-center cursor-pointer shadow-lg hover:border-[var(--accent)] transition-all select-none"
                            >
                              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                                {flashcardFlipped ? 'Answer / Concept Details' : 'Term / Question'}
                              </span>
                              <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                                {flashcardFlipped
                                  ? studyData[studyTab]?.data[flashcardIndex].back
                                  : studyData[studyTab]?.data[flashcardIndex].front}
                              </p>
                            </div>
                          )}

                          {/* Navigation Buttons */}
                          <div className="flex items-center gap-3">
                            <button
                              disabled={flashcardIndex === 0}
                              onClick={() => {
                                setFlashcardIndex((prev) => Math.max(0, prev - 1));
                                setFlashcardFlipped(false);
                              }}
                              className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] disabled:opacity-30"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                              className="px-4 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs text-[var(--accent)] font-semibold"
                            >
                              Flip Card
                            </button>
                            <button
                              disabled={flashcardIndex >= (studyData[studyTab]?.data.length || 1) - 1}
                              onClick={() => {
                                setFlashcardIndex((prev) => prev + 1);
                                setFlashcardFlipped(false);
                              }}
                              className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] disabled:opacity-30"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Markdown Rendering for Study Guide, 2/5/10 Marks, and Mermaid Diagram */
                        <ChatMarkdown content={studyData[studyTab]?.raw || ''} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
