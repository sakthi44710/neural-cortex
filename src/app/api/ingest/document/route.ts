import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { put } from '@vercel/blob';
import {
  extractEntitiesWithTypes,
  extractKeyPoints,
  generateEmbeddingSimple,
  TypedEntity,
  evaluateVisualAndDiagram,
  VisualEvaluationResult,
} from '@/lib/nvidia';
import { consensusSummarize } from '@/lib/agents';
import { hfTranscribeAudio, isHuggingFaceConfigured } from '@/lib/huggingface';

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isTextFile(filename: string, mimeType: string): boolean {
  const ext = getFileExtension(filename);
  const textExtensions = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'css', 'js', 'ts', 'py'];
  return textExtensions.includes(ext) || mimeType.startsWith('text/');
}

// --- Server-side binary file parsers for AI processing ---

// Helper to extract embedded visuals (diagrams, flowcharts, architectures) from Office ZIP archives
async function extractEmbeddedVisualsFromZip(
  buffer: Buffer,
  mediaFolderPrefix: string
): Promise<{ filename: string; mimeType: string; buffer: Buffer }[]> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.keys(zip.files).filter((name) => {
      const lower = name.toLowerCase();
      return (
        lower.startsWith(mediaFolderPrefix) &&
        (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp'))
      );
    });

    const visuals: { filename: string; mimeType: string; buffer: Buffer }[] = [];
    // Extract up to 3 primary visuals (>5KB to exclude tiny bullets/icons)
    for (const filePath of mediaFiles.slice(0, 3)) {
      const fileData = await zip.files[filePath].async('nodebuffer');
      if (fileData.length >= 5000) {
        const ext = getFileExtension(filePath);
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        visuals.push({
          filename: filePath.split('/').pop() || 'embedded_visual',
          mimeType,
          buffer: fileData,
        });
      }
    }
    return visuals;
  } catch (err) {
    console.warn(`[Visual Extraction] Could not extract media from ${mediaFolderPrefix}:`, err);
    return [];
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  let docText = '';
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    docText = result.value || '';
  } catch (err) {
    console.error('DOCX parse error:', err);
  }

  // Extract embedded images/diagrams from DOCX (word/media/)
  try {
    const embeddedImages = await extractEmbeddedVisualsFromZip(buffer, 'word/media/');
    if (embeddedImages.length > 0) {
      console.log(`[DOCX] Found ${embeddedImages.length} embedded visual(s). Evaluating diagrams...`);
      const visualSections: string[] = [];
      for (const img of embeddedImages) {
        const evalResult = await evaluateVisualAndDiagram(img.buffer, img.mimeType, img.filename);
        let section = `\n\n## Embedded Visual / Diagram: ${evalResult.title}\n`;
        section += `**Type:** ${evalResult.diagramType.toUpperCase()}\n`;
        section += `**Description:** ${evalResult.caption}\n`;
        if (evalResult.mermaidCode && evalResult.mermaidCode.trim().length > 5) {
          section += `\n\`\`\`mermaid\n${evalResult.mermaidCode.trim()}\n\`\`\`\n`;
        }
        if (evalResult.extractedText) {
          section += `**Extracted Diagram Labels:** ${evalResult.extractedText}\n`;
        }
        visualSections.push(section);
      }
      docText += visualSections.join('\n');
    }
  } catch (diagErr) {
    console.warn('[DOCX] Visual extraction failed (non-fatal):', diagErr);
  }

  return docText;
}

async function extractTextFromPdf(buffer: Buffer, filename?: string): Promise<string> {
  console.log(`[PDF] Starting extraction, buffer size: ${buffer.length} bytes, file: ${filename}`);
  try {
    // Step 1: Try text-layer extraction with unpdf
    const { extractText } = await import('unpdf');
    const data = new Uint8Array(buffer);
    const { text, totalPages } = await extractText(data, { mergePages: true });
    console.log(`[PDF] unpdf result: ${totalPages} pages, ${text.length} chars`);

    // If we got meaningful text, return it
    if (text && text.trim().length > 50) {
      console.log(`[PDF] ✅ Text-layer extraction successful`);
      return text;
    }

    // Step 2: Scanned/image-based PDF — use NVIDIA AI to generate content
    // from the document title (since we can't OCR without Tesseract)
    console.log(`[PDF] Scanned PDF detected (${totalPages} pages, only ${text.trim().length} chars). Using AI to generate content from title.`);
    const { nvidiaChat } = await import('@/lib/nvidia');
    const docTitle = filename?.replace(/\.pdf$/i, '') || 'Unknown Document';

    const aiContent = await nvidiaChat({
      messages: [
        {
          role: 'system',
          content: 'You are an expert academic content generator. Given a document title, generate comprehensive educational content that would typically be found in such a document. Be detailed, accurate, and cover key topics thoroughly. Write at least 500 words.',
        },
        {
          role: 'user',
          content: `Generate detailed educational content for a ${totalPages}-page PDF document titled "${docTitle}". Cover the key topics, concepts, definitions, and important points that would typically be found in this document. Format as clear, organized text with sections.`,
        },
      ],
      maxTokens: 4096,
      temperature: 0.3,
    });

    if (aiContent && aiContent.length > 50) {
      console.log(`[PDF] ✅ AI-generated content: ${aiContent.length} chars for scanned PDF`);
      return `[AI-Generated Content based on document title: ${docTitle}]\n\n${aiContent}`;
    }

    console.log(`[PDF] ❌ Both extraction methods yielded minimal content`);
    return text || '';
  } catch (err: any) {
    console.error('[PDF] ❌ ERROR:', err?.message || err);
    return '';
  }
}


async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const texts: string[] = [];
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort();
    for (const slidePath of slideFiles) {
      const xml = await zip.files[slidePath].async('text');
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
      if (matches) {
        const slideText = matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
        texts.push(slideText);
      }
    }
  } catch (err) {
    console.error('PPTX parse error:', err);
  }

  // Extract embedded slide diagrams & illustrations from PPTX (ppt/media/)
  try {
    const embeddedImages = await extractEmbeddedVisualsFromZip(buffer, 'ppt/media/');
    if (embeddedImages.length > 0) {
      console.log(`[PPTX] Found ${embeddedImages.length} embedded slide visual(s). Evaluating diagrams...`);
      for (const img of embeddedImages) {
        const evalResult = await evaluateVisualAndDiagram(img.buffer, img.mimeType, img.filename);
        let section = `\n\n## Slide Diagram / Architecture: ${evalResult.title}\n`;
        section += `**Visual Classification:** ${evalResult.diagramType.toUpperCase()}\n`;
        section += `**Analysis:** ${evalResult.caption}\n`;
        if (evalResult.mermaidCode && evalResult.mermaidCode.trim().length > 5) {
          section += `\n\`\`\`mermaid\n${evalResult.mermaidCode.trim()}\n\`\`\`\n`;
        }
        if (evalResult.extractedText) {
          section += `**Labels & Text:** ${evalResult.extractedText}\n`;
        }
        texts.push(section);
      }
    }
  } catch (diagErr) {
    console.warn('[PPTX] Visual extraction failed (non-fatal):', diagErr);
  }

  return texts.join('\n\n') || '';
}

async function extractTextFromFile(filename: string, buffer: Buffer, mimeType: string): Promise<string> {
  const ext = getFileExtension(filename);

  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(buffer);
  }
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return extractTextFromPdf(buffer, filename);
  }
  if (ext === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return extractTextFromPptx(buffer);
  }

  // Image & Visual formats - deep multimodal visual evaluation (OCR + captioning + Mermaid synthesis)
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
  if (imageExtensions.includes(ext) || mimeType.startsWith('image/')) {
    console.log(`[Visual] Ingesting & evaluating visual asset: ${filename}...`);
    try {
      const visualEval = await evaluateVisualAndDiagram(buffer, mimeType || `image/${ext}`, filename);
      const parts: string[] = [
        `# Visual Analysis: ${visualEval.title}`,
        `**Classification:** ${visualEval.isDiagram ? `Diagram / Technical Schema (${visualEval.diagramType})` : 'Graphic / Visual Document'}`,
        `**Overview & Summary:**\n${visualEval.caption}`,
      ];

      if (visualEval.mermaidCode && visualEval.mermaidCode.trim().length > 5) {
        parts.push(`### Synthesized Executable Diagram\n\`\`\`mermaid\n${visualEval.mermaidCode.trim()}\n\`\`\``);
      }

      if (visualEval.extractedText && visualEval.extractedText.trim().length > 0) {
        parts.push(`### Extracted Text & Annotations (OCR)\n${visualEval.extractedText.trim()}`);
      }

      return parts.join('\n\n');
    } catch (evalErr) {
      console.error(`[Visual] Evaluation failed for ${filename}, falling back to basic OCR:`, evalErr);
      const { extractTextFromImage } = await import('@/lib/nvidia');
      return extractTextFromImage(buffer, mimeType || `image/${ext}`);
    }
  }

  // Audio formats - transcribe with HuggingFace Whisper
  const audioExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'wma'];
  if (audioExtensions.includes(ext) || mimeType.startsWith('audio/')) {
    console.log(`[Audio] Transcribing ${filename} with Whisper...`);
    if (isHuggingFaceConfigured()) {
      const transcript = await hfTranscribeAudio(buffer, mimeType || 'audio/mpeg');
      if (transcript && transcript.length > 10) {
        console.log(`[Audio] ✅ Transcribed ${transcript.length} chars`);
        return `[Meeting/Audio Transcript: ${filename}]\n\n${transcript}`;
      }
    }
    console.log(`[Audio] Whisper not available or failed, using AI generation`);
    return '';
  }

  // Video formats - extract audio and transcribe with Whisper
  const videoExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'm4v'];
  if (videoExtensions.includes(ext) || mimeType.startsWith('video/')) {
    console.log(`[Video] Processing ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)...`);
    if (isHuggingFaceConfigured()) {
      // Whisper on HF servers can handle video containers (extracts audio internally)
      const audioMime = ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : mimeType || 'video/mp4';
      const transcript = await hfTranscribeAudio(buffer, audioMime);
      if (transcript && transcript.length > 10) {
        console.log(`[Video] ✅ Transcribed ${transcript.length} chars from video`);
        return `[Meeting/Video Transcript: ${filename}]\n\n${transcript}`;
      }
    }
    console.log(`[Video] Transcription failed, falling back to AI generation`);
    return '';
  }

  // Plain text fallback
  return buffer.toString('utf-8');
}

async function processDocumentWithAI(docId: string, content: string, userId: string) {
  try {
    console.log(`[AI Process] Starting for document ${docId}, content length: ${content.length}`);

    // Multi-model consensus: use both NVIDIA + HuggingFace for summarization
    const [summary, typedEntities, keyPoints] = await Promise.all([
      consensusSummarize(content),
      extractEntitiesWithTypes(content),
      extractKeyPoints(content),
    ]);

    console.log(`[AI Process] Extracted ${typedEntities.length} entities, ${keyPoints.length} key points`);

    // Sanitize entity names: truncate to safe DB length, trim whitespace
    const sanitizedEntities = typedEntities
      .map(e => ({
        name: e.name.trim().slice(0, 180),
        type: e.type,
      }))
      .filter(e => e.name.length > 0);

    const entityNames = sanitizedEntities.map(e => e.name);
    const embedding = generateEmbeddingSimple(content);

    await prisma.document.update({
      where: { id: docId },
      data: {
        summary,
        entities: JSON.stringify(entityNames),
        keyPoints: JSON.stringify(keyPoints),
        tags: JSON.stringify(entityNames.slice(0, 5)),
        embedding: JSON.stringify(embedding),
      },
    });

    console.log(`[AI Process] Document ${docId} updated with summary & entities`);

    // Create knowledge nodes from entities with proper types
    // Use individual try-catch so one failure doesn't abort all nodes
    const createdNodeLabels: string[] = [];
    for (const typedEntity of sanitizedEntities) {
      try {
        const existing = await prisma.knowledgeNode.findFirst({
          where: { userId, label: typedEntity.name },
        });

        if (!existing) {
          await prisma.knowledgeNode.create({
            data: {
              userId,
              label: typedEntity.name,
              type: typedEntity.type,
              description: `Extracted from document`,
              strength: 1.0,
              connections: '[]',
            },
          });
          console.log(`[AI Process] Created node: "${typedEntity.name}" (${typedEntity.type})`);
        } else {
          // Update type if it was previously all 'entity' (migration from old data)
          const updateData: any = { strength: existing.strength + 0.5 };
          if (existing.type === 'entity' && typedEntity.type !== 'entity') {
            updateData.type = typedEntity.type;
          }
          await prisma.knowledgeNode.update({
            where: { id: existing.id },
            data: updateData,
          });
        }
        createdNodeLabels.push(typedEntity.name);
      } catch (nodeErr) {
        console.error(`[AI Process] Failed to create/update node "${typedEntity.name}":`, nodeErr);
        // Continue with next entity instead of aborting
      }
    }

    console.log(`[AI Process] Created/updated ${createdNodeLabels.length}/${sanitizedEntities.length} knowledge nodes`);

    if (createdNodeLabels.length === 0) {
      console.log(`[AI Process] No knowledge nodes created, skipping connections`);
      return;
    }

    // Create connections between entities from the same document
    const nodes = await prisma.knowledgeNode.findMany({
      where: { userId, label: { in: createdNodeLabels } },
    });

    // Also create a 'document' type node to represent this document in the graph
    const doc = await prisma.document.findUnique({ where: { id: docId }, select: { title: true } });
    const docNodeLabel = (doc?.title || `Document ${docId.slice(0, 8)}`).slice(0, 180);
    let docNode = await prisma.knowledgeNode.findFirst({
      where: { userId, label: docNodeLabel },
    });
    if (!docNode) {
      docNode = await prisma.knowledgeNode.create({
        data: {
          userId,
          label: docNodeLabel,
          type: 'document',
          description: `Source document`,
          strength: 2.0,
          connections: JSON.stringify(nodes.map((n: { id: string }) => n.id)),
        },
      });
    } else {
      // Update existing document node's connections to include new entity nodes
      const existingConnections: string[] = JSON.parse(docNode.connections || '[]');
      const allNodeIds = nodes.map((n: { id: string }) => n.id);
      const mergedConnections = Array.from(new Set([...existingConnections, ...allNodeIds]));
      await prisma.knowledgeNode.update({
        where: { id: docNode.id },
        data: { connections: JSON.stringify(mergedConnections) },
      });
    }

    // Connect each entity node to other entities from same document + the document node
    for (const node of nodes) {
      try {
        const otherNodeIds = nodes.filter((n: { id: string }) => n.id !== node.id).map((n: { id: string }) => n.id);
        // Also connect each entity to the document node
        const allConnections = [...otherNodeIds, docNode.id];
        const existingConnections: string[] = JSON.parse(node.connections || '[]');
        const newConnections = Array.from(new Set([...existingConnections, ...allConnections]));
        await prisma.knowledgeNode.update({
          where: { id: node.id },
          data: { connections: JSON.stringify(newConnections) },
        });
      } catch (connErr) {
        console.error(`[AI Process] Failed to update connections for node "${node.label}":`, connErr);
      }
    }

    // Extract and index Diagram Knowledge Nodes if executable Mermaid blocks are present
    const mermaidMatches = content.match(/```mermaid\s*([\s\S]*?)```/g);
    if (mermaidMatches && mermaidMatches.length > 0) {
      for (let idx = 0; idx < mermaidMatches.length; idx++) {
        const rawBlock = mermaidMatches[idx];
        const innerCode = rawBlock.replace(/```mermaid\s*/, '').replace(/```$/, '').trim();
        if (innerCode.length > 5) {
          const diagLabel = `Diagram: ${(doc?.title || 'System Diagram').slice(0, 100)}${mermaidMatches.length > 1 ? ` #${idx + 1}` : ''}`;
          try {
            const diagMeta = JSON.stringify({
              isDiagram: true,
              diagramType: innerCode.includes('sequenceDiagram') ? 'sequence' : innerCode.includes('erDiagram') ? 'er' : 'architecture',
              mermaidCode: innerCode,
              sourceDocId: docId,
              sourceDocTitle: doc?.title,
            });

            const existingDiag = await prisma.knowledgeNode.findFirst({
              where: { userId, label: diagLabel },
            });

            if (!existingDiag) {
              const diagNode = await prisma.knowledgeNode.create({
                data: {
                  userId,
                  label: diagLabel,
                  type: 'diagram',
                  description: `Synthesized executable diagram from ${doc?.title || 'document'}.`,
                  strength: 2.5,
                  connections: JSON.stringify([docNode.id, ...nodes.slice(0, 5).map((n: { id: string }) => n.id)]),
                  metadata: diagMeta,
                },
              });
              console.log(`[AI Process] ✅ Created diagram knowledge node: "${diagLabel}" (${diagNode.id})`);
            } else {
              await prisma.knowledgeNode.update({
                where: { id: existingDiag.id },
                data: {
                  metadata: diagMeta,
                  strength: existingDiag.strength + 0.5,
                },
              });
            }
          } catch (diagErr) {
            console.warn('[AI Process] Failed to create diagram node:', diagErr);
          }
        }
      }
    }

    console.log(`[AI Process] ✅ Document ${docId} fully processed: ${createdNodeLabels.length} entities, ${keyPoints.length} key points, graph updated`);
  } catch (error) {
    console.error('[AI Process] ❌ Failed to process document with AI:', error);
  }
}

// Allow larger uploads (video/audio files)
export const maxDuration = 60; // seconds

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let title: string;
  let content: string;
  let contentType = 'text';
  let domain = 'general';
  let fileUrl: string | null = null;
  let fileType: string | null = null;
  let fileSize: number | null = null;

  const ct = req.headers.get('content-type') || '';

  if (ct.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (file && file.size > 0) {
      // Server-side file size validation
      if (file.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json(
          { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 25MB.` },
          { status: 413 }
        );
      }

      title = (formData.get('title') as string) || file.name;
      domain = (formData.get('domain') as string) || 'general';
      fileType = file.type || getFileExtension(file.name);
      fileSize = file.size;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload original file to Vercel Blob (preserves diagrams, images, formatting)
      try {
        const blob = await put(`documents/${session.user.id}/${Date.now()}-${file.name}`, file, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        fileUrl = blob.url;
      } catch (err) {
        console.error('Blob upload error:', err);
      }

      // Extract text from ALL file types for AI processing (RAG, entities, graph)
      if (isTextFile(file.name, file.type)) {
        content = buffer.toString('utf-8').replace(/\x00/g, '').trim();
      } else {
        // Binary files: extract text for AI while original stays in Blob
        try {
          content = await extractTextFromFile(file.name, buffer, file.type);
          content = content.replace(/\x00/g, '').trim();
        } catch (err) {
          console.error('Text extraction error:', err);
          content = '';
        }

        // If extraction yielded nothing useful, use AI to generate content from title
        if (!content || content.trim().length < 20) {
          console.log(`[Ingest] Text extraction yielded too little content for ${file.name}, attempting AI generation from title...`);
          try {
            const { nvidiaChat } = await import('@/lib/nvidia');
            const docTitle = file.name.replace(/\.[^.]+$/, '');
            const aiContent = await nvidiaChat({
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert content generator. Given a document title, generate comprehensive content that would typically be found in such a document. Be detailed and accurate. Write at least 500 words.',
                },
                {
                  role: 'user',
                  content: `Generate detailed content for a document titled "${docTitle}" (file type: ${file.type || 'unknown'}). Cover the key topics, concepts, and important points.`,
                },
              ],
              maxTokens: 4096,
              temperature: 0.3,
            });
            if (aiContent && aiContent.length > 50) {
              content = `[AI-Generated Content based on: ${docTitle}]\n\n${aiContent}`;
              console.log(`[Ingest] ✅ AI-generated ${aiContent.length} chars for ${file.name}`);
            } else {
              content = `[File: ${file.name}] (${file.type || 'unknown type'}, ${(file.size / 1024).toFixed(1)} KB)`;
            }
          } catch (aiErr) {
            console.error('[Ingest] AI content generation failed:', aiErr);
            content = `[File: ${file.name}] (${file.type || 'unknown type'}, ${(file.size / 1024).toFixed(1)} KB)`;
          }
        }
      }

      const ext = getFileExtension(file.name);
      contentType = ext === 'md' || ext === 'markdown' ? 'markdown' : ext === 'json' ? 'json' : ext;
    } else {
      // Fallback: text content in form fields
      title = (formData.get('title') as string) || '';
      content = (formData.get('content') as string) || '';
      contentType = (formData.get('type') as string) || 'text';
      domain = (formData.get('domain') as string) || 'general';
    }
  } else {
    // JSON body
    const body = await req.json();
    title = body.title;
    content = body.content;
    contentType = body.contentType || 'text';
    domain = body.domain || 'general';
  }

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const document = await prisma.document.create({
    data: {
      userId: session.user.id,
      title,
      content: (content || '').slice(0, 50000),
      contentType,
      domain,
      fileUrl,
      fileType,
      fileSize,
    },
  });

  // Process text content with AI (summaries, entities, knowledge graph, embeddings)
  // Process if we have real content (including AI-generated content for binary files)
  const hasProcessableContent = content && content.length > 20 && !content.startsWith('[File:');
  if (hasProcessableContent) {
    // Strip the AI-generated prefix for processing
    const processContent = content.replace(/^\[AI-Generated Content based on:.*?\]\n\n/, '');
    processDocumentWithAI(document.id, processContent, session.user.id).catch(console.error);
  }

  return NextResponse.json({ document });
  } catch (err: any) {
    console.error('[Ingest POST] Unhandled error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message?.includes('body') || err?.message?.includes('size')
          ? 'File too large to process. Try a smaller file (max 25MB).'
          : 'Failed to process file. Please try again.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');
  if (!docId) {
    return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc || doc.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let content = doc.content;

  // If content is just file metadata (extraction previously failed),
  // re-download from Blob and re-extract text
  if (content.startsWith('[File:') && doc.fileUrl) {
    console.log(`[REPROCESS] Re-downloading ${doc.title} from Blob for re-extraction...`);
    try {
      const response = await fetch(doc.fileUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filename = doc.title || 'unknown';
        const mimeType = doc.fileType || '';

        content = await extractTextFromFile(filename, buffer, mimeType);
        content = content.replace(/\x00/g, '').trim();

        if (content && content.length > 10) {
          // Update the stored content with the properly extracted text
          await prisma.document.update({
            where: { id: docId },
            data: { content: content.slice(0, 50000) },
          });
          console.log(`[REPROCESS] ✅ Re-extracted ${content.length} chars from ${doc.title}`);
        } else {
          console.log(`[REPROCESS] ❌ Re-extraction still yielded no text for ${doc.title}`);
          return NextResponse.json({ error: 'Could not extract text from file' }, { status: 422 });
        }
      }
    } catch (err: any) {
      console.error(`[REPROCESS] Error re-extracting ${doc.title}:`, err?.message);
      return NextResponse.json({ error: 'Failed to re-extract text' }, { status: 500 });
    }
  }

  // Process with AI
  if (content && content.length > 20 && !content.startsWith('[File:')) {
    processDocumentWithAI(docId, content, session.user.id).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
