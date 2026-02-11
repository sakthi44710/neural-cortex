import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { put } from '@vercel/blob';
import { generateSummary, extractEntitiesWithTypes, extractKeyPoints, generateEmbeddingSimple, TypedEntity } from '@/lib/nvidia';

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isTextFile(filename: string, mimeType: string): boolean {
  const ext = getFileExtension(filename);
  const textExtensions = ['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'css', 'js', 'ts', 'py'];
  return textExtensions.includes(ext) || mimeType.startsWith('text/');
}

// --- Server-side binary file parsers for AI processing ---

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err) {
    console.error('DOCX parse error:', err);
    return '';
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  console.log(`[PDF] Starting extraction, buffer size: ${buffer.length} bytes`);
  try {
    // Use unpdf — serverless-native PDF parser (works on Vercel, Edge, Node)
    const { extractText } = await import('unpdf');
    const data = new Uint8Array(buffer);
    const { text, totalPages } = await extractText(data, { mergePages: true });
    console.log(`[PDF] ✅ SUCCESS: ${totalPages} pages, ${text.length} chars extracted`);
    return text || '';
  } catch (err: any) {
    console.error('[PDF] ❌ ERROR:', err?.message || err);
    return '';
  }
}

async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const texts: string[] = [];
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
    return texts.join('\n\n') || '';
  } catch (err) {
    console.error('PPTX parse error:', err);
    return '';
  }
}

async function extractTextFromFile(filename: string, buffer: Buffer, mimeType: string): Promise<string> {
  const ext = getFileExtension(filename);

  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(buffer);
  }
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return extractTextFromPdf(buffer);
  }
  if (ext === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return extractTextFromPptx(buffer);
  }

  // Image formats - use NVIDIA vision API for OCR
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  if (imageExtensions.includes(ext) || mimeType.startsWith('image/')) {
    const { extractTextFromImage } = await import('@/lib/nvidia');
    return extractTextFromImage(buffer, mimeType || `image/${ext}`);
  }

  // Plain text fallback
  return buffer.toString('utf-8');
}

async function processDocumentWithAI(docId: string, content: string, userId: string) {
  try {
    const [summary, typedEntities, keyPoints] = await Promise.all([
      generateSummary(content),
      extractEntitiesWithTypes(content),
      extractKeyPoints(content),
    ]);

    const entityNames = typedEntities.map(e => e.name);
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

    // Create knowledge nodes from entities with proper types
    for (const typedEntity of typedEntities) {
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
    }

    // Create connections between entities from the same document
    const nodes = await prisma.knowledgeNode.findMany({
      where: { userId, label: { in: entityNames } },
    });

    // Also create a 'document' type node to represent this document in the graph
    const doc = await prisma.document.findUnique({ where: { id: docId }, select: { title: true } });
    const docNodeLabel = doc?.title || `Document ${docId.slice(0, 8)}`;
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
    }

    for (const node of nodes) {
      const otherNodeIds = nodes.filter((n: { id: string }) => n.id !== node.id).map((n: { id: string }) => n.id);
      // Also connect each entity to the document node
      const allConnections = [...otherNodeIds, docNode.id];
      const existingConnections: string[] = JSON.parse(node.connections || '[]');
      const newConnections = Array.from(new Set([...existingConnections, ...allConnections]));
      await prisma.knowledgeNode.update({
        where: { id: node.id },
        data: { connections: JSON.stringify(newConnections) },
      });
    }

    console.log(`Document ${docId} processed: ${typedEntities.length} entities, ${keyPoints.length} key points`);
  } catch (error) {
    console.error('Failed to process document with AI:', error);
  }
}

export async function POST(req: NextRequest) {
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
          content = `[File: ${file.name}] (${file.type || 'unknown type'}, ${(file.size / 1024).toFixed(1)} KB)`;
        }

        // If extraction yielded nothing useful, use filename as content
        if (!content || content.trim().length < 10) {
          content = `[File: ${file.name}] (${file.type || 'unknown type'}, ${(file.size / 1024).toFixed(1)} KB)`;
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
  if (content && content.length > 20 && !content.startsWith('[File:')) {
    processDocumentWithAI(document.id, content, session.user.id).catch(console.error);
  }

  return NextResponse.json({ document });
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

  // Re-process with AI
  if (doc.content && doc.content.length > 20 && !doc.content.startsWith('[File:')) {
    processDocumentWithAI(docId, doc.content, session.user.id).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
