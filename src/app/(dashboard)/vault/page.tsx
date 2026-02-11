'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Upload, FileText, Trash2, Clock, Search, X, Eye, Brain, Loader2, ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatRelativeDate } from '@/lib/utils';

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

export default function VaultPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);

        const res = await fetch('/api/ingest/document', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          toast.success(`"${file.name}" uploaded & processing with AI`);
          fetchDocuments();
          setTimeout(fetchDocuments, 8000);
          setTimeout(fetchDocuments, 15000);
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || `Failed to upload ${file.name}`);
        }
      } catch (error) {
        toast.error(`Error uploading ${file.name}`);
      } finally {
        setUploading(false);
      }
    }
  }, []);

  const isImageFile = (type: string | null) => {
    if (!type) return false;
    return type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(type);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
  });

  const processDocument = async (docId: string) => {
    setProcessing(docId);
    try {
      const res = await fetch(`/api/ingest/document?id=${docId}`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Document processed with AI');
        setTimeout(fetchDocuments, 3000);
      }
    } catch (error) {
      toast.error('Processing failed');
    } finally {
      setProcessing(null);
    }
  };

  const deleteDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents?id=${docId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Document deleted');
        fetchDocuments();
        if (selectedDoc?.id === docId) setSelectedDoc(null);
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const filteredDocs = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parseTags = (tags: string | null): string[] => {
    try {
      return JSON.parse(tags || '[]');
    } catch {
      return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Vault</h1>
          <p className="text-text-secondary mt-1">
            {documents.length} document{documents.length !== 1 ? 's' : ''} in your vault
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-dark pl-10 py-2 w-64"
          />
        </div>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${isDragActive
            ? 'border-neon-blue bg-neon-blue/5'
            : 'border-border-custom hover:border-neon-blue/50 hover:bg-white/[0.02]'
          }`}
      >
        <input {...getInputProps()} />
        <Upload
          className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragActive ? 'text-neon-blue' : 'text-text-secondary'
            }`}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-neon-blue" />
            <p className="text-neon-blue">Processing document...</p>
          </div>
        ) : isDragActive ? (
          <p className="text-neon-blue text-lg">Drop files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium mb-1">Drop files here or click to upload</p>
            <p className="text-text-secondary text-sm">Supports DOCX, PDF, PPTX, TXT, MD, JSON, CSV, PNG, JPG, GIF, WEBP files</p>
          </>
        )}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredDocs.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-2xl glass card-hover group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${isImageFile(doc.fileType) ? 'from-neon-green/20 to-neon-blue/20' : 'from-neon-blue/20 to-neon-purple/20'} flex items-center justify-center shrink-0 overflow-hidden`}>
                    {isImageFile(doc.fileType) && doc.fileUrl ? (
                      <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover rounded-xl" />
                    ) : isImageFile(doc.fileType) ? (
                      <ImageIcon className="w-5 h-5 text-neon-green" />
                    ) : (
                      <FileText className="w-5 h-5 text-neon-blue" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{doc.title}</h3>
                    <p className="text-xs text-text-secondary flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => setSelectedDoc(doc)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title="View"
                  >
                    <Eye className="w-4 h-4 text-text-secondary" />
                  </button>
                  {!doc.summary && (
                    <button
                      onClick={() => processDocument(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      disabled={processing === doc.id}
                      title="Process with AI"
                    >
                      <Brain
                        className={`w-4 h-4 ${processing === doc.id ? 'text-neon-blue animate-pulse' : 'text-text-secondary'
                          }`}
                      />
                    </button>
                  )}
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                  </button>
                </div>
              </div>

              {doc.summary ? (
                <p className="text-sm text-text-secondary line-clamp-2 mb-3">{doc.summary}</p>
              ) : (
                <p className="text-sm text-text-secondary line-clamp-3 mb-3">{doc.content}</p>
              )}

              {parseTags(doc.tags).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parseTags(doc.tags)
                    .slice(0, 3)
                    .map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-xs bg-neon-purple/10 text-neon-purple border border-neon-purple/20"
                      >
                        {tag}
                      </span>
                    ))}
                  {parseTags(doc.tags).length > 3 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-text-secondary">
                      +{parseTags(doc.tags).length - 3}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredDocs.length === 0 && !uploading && (
        <div className="text-center py-16 text-text-secondary">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">No documents yet</p>
          <p className="text-sm mt-1">Upload your first document to get started</p>
        </div>
      )}

      {/* Document Preview Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedDoc(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[80vh] rounded-2xl glass-strong overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-border-custom">
                <h2 className="text-lg font-bold truncate pr-4">{selectedDoc.title}</h2>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-2 rounded-xl hover:bg-white/10 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-5rem)]">
                {selectedDoc.summary && (
                  <div className="mb-4 p-4 rounded-xl bg-neon-blue/5 border border-neon-blue/20">
                    <h3 className="text-sm font-semibold text-neon-blue mb-2">AI Summary</h3>
                    <p className="text-sm text-text-secondary">{selectedDoc.summary}</p>
                  </div>
                )}
                {selectedDoc.keyPoints && (
                  <div className="mb-4 p-4 rounded-xl bg-neon-purple/5 border border-neon-purple/20">
                    <h3 className="text-sm font-semibold text-neon-purple mb-2">Key Points</h3>
                    <ul className="text-sm text-text-secondary space-y-1">
                      {JSON.parse(selectedDoc.keyPoints || '[]').map((point: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-neon-purple mt-0.5">&#x2022;</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedDoc.entities && JSON.parse(selectedDoc.entities || '[]').length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-2">Entities</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {JSON.parse(selectedDoc.entities).map((entity: string) => (
                        <span
                          key={entity}
                          className="px-2.5 py-1 rounded-lg text-xs bg-neon-green/10 text-neon-green border border-neon-green/20"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {isImageFile(selectedDoc.fileType) && selectedDoc.fileUrl && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-2">Image Preview</h3>
                    <img
                      src={selectedDoc.fileUrl}
                      alt={selectedDoc.title}
                      className="max-w-full rounded-xl border border-border-custom"
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Content</h3>
                  <pre className="text-sm text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">
                    {selectedDoc.content}
                  </pre>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
