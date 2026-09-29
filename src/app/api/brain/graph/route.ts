import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { extractEntitiesWithTypes, generateSummary, extractKeyPoints, generateEmbeddingSimple } from '@/lib/nvidia';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nodes = await prisma.knowledgeNode.findMany({
    where: { userId: session.user.id },
  });

  const graphNodes = nodes.map((n: { id: string; label: string; type: string; strength: number }) => ({
    id: n.id,
    label: n.label,
    type: n.type,
    strength: n.strength,
  }));

  // Build links from connections
  const links: { source: string; target: string; strength: number }[] = [];
  const addedLinks = new Set<string>();

  for (const node of nodes) {
    let connections: string[] = [];
    try {
      connections = JSON.parse(node.connections || '[]');
    } catch {
      connections = [];
    }

    for (const targetId of connections) {
      // Verify target exists
      const targetExists = nodes.some((n: { id: string }) => n.id === targetId);
      if (!targetExists) continue;

      const linkKey = [node.id, targetId].sort().join('|');
      if (!addedLinks.has(linkKey)) {
        addedLinks.add(linkKey);
        links.push({
          source: node.id,
          target: targetId,
          strength: node.strength,
        });
      }
    }
  }

  return NextResponse.json({ nodes: graphNodes, links });
}

// Rebuild knowledge graph from all existing documents
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Step 1: Get ALL documents — including those without entities
  const allDocuments = await prisma.document.findMany({
    where: { userId },
    select: { id: true, title: true, content: true, entities: true, summary: true },
  });

  let nodesCreated = 0;
  let connectionsCreated = 0;
  let docsProcessed = 0;

  for (const doc of allDocuments) {
    // Skip documents with no real content
    if (!doc.content || doc.content.length < 20 || doc.content.startsWith('[File:')) {
      continue;
    }

    let entities: { name: string; type: string }[] = [];

    // Check if entities already exist in DB
    let hasExistingEntities = false;
    if (doc.entities) {
      try {
        const parsed = JSON.parse(doc.entities);
        if (Array.isArray(parsed) && parsed.length > 0) {
          entities = parsed.map((e: any) => {
            if (typeof e === 'string') {
              return { name: e.trim().slice(0, 180), type: 'entity' };
            }
            return { name: String(e.name || e).trim().slice(0, 180), type: e.type || 'entity' };
          }).filter((e: any) => e.name.length > 0);
          hasExistingEntities = entities.length > 0;
        }
      } catch {}
    }

    // If no entities yet, run AI extraction now
    if (!hasExistingEntities) {
      console.log(`[Rebuild] Document "${doc.title}" has no entities — running AI extraction...`);
      try {
        const content = doc.content.replace(/^\[AI-Generated Content based on:.*?\]\n\n/, '');

        // Run AI extraction in parallel
        const [typedEntities, summary, keyPoints] = await Promise.all([
          extractEntitiesWithTypes(content),
          doc.summary ? Promise.resolve(doc.summary) : generateSummary(content),
          extractKeyPoints(content),
        ]);

        entities = typedEntities.map(e => ({
          name: e.name.trim().slice(0, 180),
          type: e.type,
        })).filter(e => e.name.length > 0);

        const entityNames = entities.map(e => e.name);
        const embedding = generateEmbeddingSimple(content);

        // Save extracted data to document
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            summary: typeof summary === 'string' ? summary : doc.summary,
            entities: JSON.stringify(entityNames),
            keyPoints: JSON.stringify(keyPoints),
            tags: JSON.stringify(entityNames.slice(0, 5)),
            embedding: JSON.stringify(embedding),
          },
        });

        console.log(`[Rebuild] ✅ Extracted ${entities.length} entities from "${doc.title}"`);
      } catch (err) {
        console.error(`[Rebuild] ❌ AI extraction failed for "${doc.title}":`, err);
        continue;
      }
    }

    if (entities.length === 0) continue;
    docsProcessed++;

    const entityNames: string[] = [];

    // Create knowledge nodes for each entity
    for (const entity of entities) {
      try {
        const existing = await prisma.knowledgeNode.findFirst({
          where: { userId, label: entity.name },
        });

        if (!existing) {
          await prisma.knowledgeNode.create({
            data: {
              userId,
              label: entity.name,
              type: entity.type,
              description: `Extracted from document`,
              strength: 1.0,
              connections: '[]',
            },
          });
          nodesCreated++;
        } else {
          await prisma.knowledgeNode.update({
            where: { id: existing.id },
            data: { strength: Math.min(existing.strength + 0.3, 10) },
          });
        }
        entityNames.push(entity.name);
      } catch (err) {
        console.error(`[Rebuild] Failed to create node "${entity.name}":`, err);
      }
    }

    if (entityNames.length === 0) continue;

    // Get all nodes for this document's entities
    const entityNodes = await prisma.knowledgeNode.findMany({
      where: { userId, label: { in: entityNames } },
    });

    // Create/update document node
    const docNodeLabel = (doc.title || `Document ${doc.id.slice(0, 8)}`).slice(0, 180);
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
          connections: JSON.stringify(entityNodes.map(n => n.id)),
        },
      });
      nodesCreated++;
    } else {
      const existing: string[] = JSON.parse(docNode.connections || '[]');
      const merged = Array.from(new Set([...existing, ...entityNodes.map(n => n.id)]));
      await prisma.knowledgeNode.update({
        where: { id: docNode.id },
        data: { connections: JSON.stringify(merged) },
      });
    }

    // Connect entity nodes to each other and to the document node
    for (const node of entityNodes) {
      try {
        const otherIds = entityNodes.filter(n => n.id !== node.id).map(n => n.id);
        const allConnections = [...otherIds, docNode.id];
        const existingConns: string[] = JSON.parse(node.connections || '[]');
        const newConns = Array.from(new Set([...existingConns, ...allConnections]));
        if (newConns.length !== existingConns.length) {
          await prisma.knowledgeNode.update({
            where: { id: node.id },
            data: { connections: JSON.stringify(newConns) },
          });
          connectionsCreated += newConns.length - existingConns.length;
        }
      } catch (err) {
        console.error(`[Rebuild] Failed to update connections for "${node.label}":`, err);
      }
    }
  }

  console.log(`[Rebuild] ✅ Graph rebuilt: ${nodesCreated} new nodes, ${connectionsCreated} new connections from ${docsProcessed} documents`);
  return NextResponse.json({ success: true, nodesCreated, connectionsCreated, documentsProcessed: docsProcessed });
}