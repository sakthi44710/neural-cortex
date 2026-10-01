import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q) {
      return NextResponse.json({
        documents: [],
        conversations: [],
        knowledgeNodes: [],
      });
    }

    const [documents, conversations, knowledgeNodes] = await Promise.all([
      prisma.document.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: q } },
            { summary: { contains: q } },
            { domain: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          fileType: true,
          domain: true,
          summary: true,
          contentType: true,
          updatedAt: true,
        },
        take: 6,
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.conversation.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: q } },
            {
              messages: {
                some: {
                  content: { contains: q },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { content: true },
          },
        },
        take: 6,
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.knowledgeNode.findMany({
        where: {
          userId,
          type: { notIn: ['study_artifact'] },
          OR: [
            { label: { contains: q } },
            { description: { contains: q } },
            { type: { contains: q } },
          ],
        },
        select: {
          id: true,
          label: true,
          type: true,
          description: true,
        },
        take: 12,
      }),
    ]);

    const isRawId = (str: string) => /^c[a-z0-9]{20,}$/i.test(str) || /^[0-9a-f-]{32,}$/i.test(str);
    const filteredKnowledgeNodes = (knowledgeNodes || [])
      .filter((n: any) => n.type !== 'study_artifact' && !isRawId(n.label?.trim() || ''))
      .slice(0, 6);

    return NextResponse.json({
      documents,
      conversations,
      knowledgeNodes: filteredKnowledgeNodes,
    });
  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Search failed', details: error.message }, { status: 500 });
  }
}
