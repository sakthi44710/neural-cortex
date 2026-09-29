import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch core data in parallel
    const [
      docCount,
      convCount,
      nodeCount,
      allDocs,
      allNodes,
      recentDocsGrowth,
      recentNodesGrowth,
      recentConvsGrowth,
    ] = await Promise.all([
      prisma.document.count({ where: { userId } }),
      prisma.conversation.count({ where: { userId } }),
      prisma.knowledgeNode.count({ where: { userId } }),
      prisma.document.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          domain: true,
          tags: true,
          entities: true,
          keyPoints: true,
          createdAt: true,
          contentType: true,
          fileType: true,
        },
      }),
      prisma.knowledgeNode.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          label: true,
          type: true,
          strength: true,
          connections: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.document.count({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.knowledgeNode.count({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.conversation.count({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
      }),
    ]);

    // 1. Calculate actual relationships & connection network
    let totalRelationships = 0;
    const connectionsList: {
      source: string;
      target: string;
      strength: number;
      type: string;
    }[] = [];

    const nodeLabelMap = new Map<string, string>();
    allNodes.forEach((n) => nodeLabelMap.set(n.id, n.label));

    allNodes.forEach((node) => {
      if (node.connections) {
        try {
          const parsed = JSON.parse(node.connections);
          if (Array.isArray(parsed)) {
            totalRelationships += parsed.length;
            parsed.forEach((targetId: string) => {
              const targetLabel = nodeLabelMap.get(targetId) || targetId;
              connectionsList.push({
                source: node.label,
                target: targetLabel,
                strength: node.strength || 1,
                type: node.type || 'concept',
              });
            });
          }
        } catch {
          totalRelationships += 1;
        }
      }
    });

    // 2. Count entities across documents and knowledge nodes
    const entityStats: Record<
      string,
      { count: number; sources: string[]; type: string; connections: number }
    > = {};

    // From KnowledgeNodes
    allNodes.forEach((node) => {
      const key = node.label.trim();
      let connCount = 0;
      if (node.connections) {
        try {
          connCount = JSON.parse(node.connections).length;
        } catch {
          connCount = 1;
        }
      }
      entityStats[key] = {
        count: (entityStats[key]?.count || 0) + 1,
        sources: entityStats[key]?.sources || [],
        type: node.type || 'concept',
        connections: Math.max(entityStats[key]?.connections || 0, connCount),
      };
    });

    // From Document extracted entities
    allDocs.forEach((doc) => {
      if (doc.entities) {
        try {
          const parsed = JSON.parse(doc.entities);
          if (Array.isArray(parsed)) {
            parsed.forEach((e: string) => {
              const name = typeof e === 'string' ? e.trim() : (e as any)?.name || '';
              if (!name) return;
              if (!entityStats[name]) {
                entityStats[name] = { count: 0, sources: [], type: 'entity', connections: 0 };
              }
              entityStats[name].count += 1;
              if (!entityStats[name].sources.includes(doc.title)) {
                entityStats[name].sources.push(doc.title);
              }
            });
          }
        } catch {}
      }
    });

    const topEntities = Object.entries(entityStats)
      .map(([name, data]) => ({
        name,
        count: data.count,
        sources: data.sources.slice(0, 3),
        type: data.type,
        connections: data.connections,
      }))
      .sort((a, b) => b.count - a.count || b.connections - a.connections)
      .slice(0, 12);

    // 3. Dynamic Knowledge Domains
    const domainMap: Record<
      string,
      { docCount: number; docs: string[]; entities: Set<string> }
    > = {};

    allDocs.forEach((doc) => {
      const rawDomain = doc.domain && doc.domain.trim() !== '' ? doc.domain.trim() : 'General';
      const domain = rawDomain.charAt(0).toUpperCase() + rawDomain.slice(1);
      if (!domainMap[domain]) {
        domainMap[domain] = { docCount: 0, docs: [], entities: new Set() };
      }
      domainMap[domain].docCount += 1;
      domainMap[domain].docs.push(doc.title);

      if (doc.entities) {
        try {
          const ent = JSON.parse(doc.entities);
          if (Array.isArray(ent)) {
            ent.forEach((e: string) => domainMap[domain].entities.add(typeof e === 'string' ? e : (e as any).name));
          }
        } catch {}
      }
    });

    const domains = Object.entries(domainMap).map(([name, data]) => ({
      name,
      docCount: data.docCount,
      entityCount: data.entities.size,
      sampleDocs: data.docs.slice(0, 2),
      completenessScore: Math.min(100, Math.round((data.docCount * 25 + data.entities.size * 5))),
    })).sort((a, b) => b.docCount - a.docCount);

    // 4. Knowledge Growth timeline (last 14 days)
    const timelineDays: { date: string; label: string; docs: number; nodes: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const dayDocs = allDocs.filter((doc) => doc.createdAt.toISOString().startsWith(dateStr)).length;
      const dayNodes = allNodes.filter((node) => node.createdAt.toISOString().startsWith(dateStr)).length;

      timelineDays.push({
        date: dateStr,
        label: dayLabel,
        docs: dayDocs,
        nodes: dayNodes,
      });
    }

    // 5. Intelligent Knowledge Gaps detection
    const knowledgeGaps: {
      id: string;
      domain: string;
      title: string;
      description: string;
      severity: 'high' | 'medium' | 'low';
      recommendedTopic: string;
    }[] = [];

    // Detect domains with low concept density or single documents
    domains.forEach((dom, idx) => {
      if (dom.docCount >= 1 && dom.entityCount < 3) {
        knowledgeGaps.push({
          id: `gap-${idx}`,
          domain: dom.name,
          title: `Low concept density in ${dom.name}`,
          description: `You have indexed ${dom.docCount} document(s) in ${dom.name}, but only ${dom.entityCount} distinct concepts have been extracted. Processing or adding supplementary notes will enrich retrieval.`,
          severity: 'medium',
          recommendedTopic: `${dom.name} fundamental principles & paradigms`,
        });
      }
    });

    // If specific computer science / DBMS topics are detected, check for common subtopics
    const dbmsDoc = allDocs.find((d) => d.title.toLowerCase().includes('dbms') || d.title.toLowerCase().includes('database'));
    if (dbmsDoc) {
      const allEnts = Object.keys(entityStats).map((e) => e.toLowerCase());
      const hasTransactions = allEnts.some((e) => e.includes('transaction') || e.includes('acid') || e.includes('recovery'));
      if (!hasTransactions) {
        knowledgeGaps.push({
          id: 'gap-dbms-tx',
          domain: 'Database Systems',
          title: 'Missing Transaction & Concurrency Foundations',
          description: 'Your DBMS materials focus on schema and structure, but lack coverage of ACID properties, write-ahead logging (WAL), and concurrency isolation levels.',
          severity: 'high',
          recommendedTopic: 'ACID transactions, 2-Phase Locking, and WAL recovery',
        });
      }
    }

    // Default gap if vault is young
    if (knowledgeGaps.length === 0 && docCount < 3) {
      knowledgeGaps.push({
        id: 'gap-initial',
        domain: 'Knowledge Base Expansion',
        title: 'Initial Cross-Domain Linkages Needed',
        description: 'Upload 2-3 additional documents across your core study or engineering focus to allow Neural Cortex to map cross-document synthesis paths.',
        severity: 'low',
        recommendedTopic: 'System architecture or course notes',
      });
    }

    // Count projects (from documents with project tag)
    const projectTags = new Set<string>();
    allDocs.forEach((d) => {
      if (d.tags) {
        d.tags.split(',').forEach((t) => {
          const trimmed = t.trim();
          if (trimmed.startsWith('project:')) projectTags.add(trimmed.replace('project:', ''));
        });
      }
    });

    return NextResponse.json({
      stats: {
        documents: docCount,
        conversations: convCount,
        nodes: nodeCount,
        relationships: totalRelationships,
        projects: projectTags.size,
        growth: {
          documents: recentDocsGrowth,
          nodes: recentNodesGrowth,
          conversations: recentConvsGrowth,
        },
      },
      topEntities,
      domains,
      timeline: timelineDays,
      gaps: knowledgeGaps,
      recentConnections: connectionsList.slice(0, 6),
    });
  } catch (error) {
    console.error('Failed to generate insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
