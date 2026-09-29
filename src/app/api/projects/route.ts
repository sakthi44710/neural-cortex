import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { nvidiaChat, isNvidiaConfigured } from '@/lib/nvidia';
import { hfChat, isHuggingFaceConfigured } from '@/lib/huggingface';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const rawProjects = await prisma.document.findMany({
      where: {
        userId,
        contentType: 'project_manifest',
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        summary: true,
        domain: true,
        tags: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let projects = rawProjects.map((p) => {
      try {
        const parsed = JSON.parse(p.content);
        return {
          id: p.id,
          name: parsed.name || p.title.replace('Project: ', ''),
          description: parsed.description || p.summary || '',
          domain: p.domain || 'General',
          customInstructions: parsed.customInstructions || '',
          documentIds: parsed.documentIds || [],
          conversationIds: parsed.conversationIds || [],
          artifacts: parsed.artifacts || [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      } catch {
        return {
          id: p.id,
          name: p.title.replace('Project: ', ''),
          description: p.summary || '',
          domain: p.domain || 'General',
          customInstructions: '',
          documentIds: [],
          conversationIds: [],
          artifacts: [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }
    });

    // If user has zero projects, let's discover if they have documents to seed an initial project
    if (projects.length === 0) {
      const userDocs = await prisma.document.findMany({
        where: { userId, contentType: { not: 'project_manifest' } },
        take: 5,
        select: { id: true, title: true, domain: true },
      });

      if (userDocs.length > 0) {
        const primaryDomain = userDocs[0].domain || 'Computer Science';
        const initialProjectData = {
          name: `${primaryDomain.toUpperCase()} Core Preparation`,
          description: `Integrated workspace for ${primaryDomain} research, notes, and study artifacts.`,
          domain: primaryDomain,
          customInstructions: 'Explain concepts with high technical precision and academic exam rigor.',
          documentIds: userDocs.map((d) => d.id),
          conversationIds: [],
          artifacts: [
            {
              id: `art_${Date.now()}`,
              title: `${primaryDomain} Synthesis Guide`,
              type: 'study-guide',
              content: `# ${primaryDomain} Knowledge Synthesis\n\n*Created automatically from your active Knowledge Vault sources.*\n\n### Linked Documents\n${userDocs
                .map((d) => `- **${d.title}**`)
                .join('\n')}\n\n### Core Directives\n- Use project instructions for all converse sessions.\n- Review key concepts and generated study artifacts.\n`,
              createdAt: new Date().toISOString(),
            },
          ],
        };

        const created = await prisma.document.create({
          data: {
            userId,
            title: `Project: ${initialProjectData.name}`,
            summary: initialProjectData.description,
            domain: primaryDomain,
            contentType: 'project_manifest',
            fileType: 'json',
            content: JSON.stringify(initialProjectData),
          },
        });

        projects = [
          {
            id: created.id,
            ...initialProjectData,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          },
        ];
      }
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Failed to load projects:', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const body = await req.json();
    const {
      name,
      description = '',
      domain = 'General',
      customInstructions = '',
      documentIds = [],
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const projectPayload = {
      name: name.trim(),
      description: description.trim(),
      domain: domain.trim(),
      customInstructions: customInstructions.trim(),
      documentIds,
      conversationIds: [],
      artifacts: [],
    };

    const doc = await prisma.document.create({
      data: {
        userId,
        title: `Project: ${name.trim()}`,
        summary: description.trim() || `Workspace for ${name.trim()}`,
        domain: domain.trim() || 'General',
        contentType: 'project_manifest',
        fileType: 'json',
        content: JSON.stringify(projectPayload),
      },
    });

    return NextResponse.json({
      project: {
        id: doc.id,
        ...projectPayload,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const body = await req.json();
    const { id, name, description, domain, customInstructions, documentIds, artifacts } = body;

    if (!id) {
      return NextResponse.json({ error: 'Project id required' }, { status: 400 });
    }

    const existing = await prisma.document.findFirst({
      where: { id, userId, contentType: 'project_manifest' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let parsed = {};
    try {
      parsed = JSON.parse(existing.content);
    } catch {}

    const updatedPayload = {
      ...parsed,
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(domain !== undefined && { domain: domain.trim() }),
      ...(customInstructions !== undefined && { customInstructions: customInstructions.trim() }),
      ...(documentIds !== undefined && { documentIds }),
      ...(artifacts !== undefined && { artifacts }),
    };

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: name ? `Project: ${name.trim()}` : existing.title,
        summary: description !== undefined ? description : existing.summary,
        domain: domain !== undefined ? domain : existing.domain,
        content: JSON.stringify(updatedPayload),
      },
    });

    return NextResponse.json({
      project: {
        id: updated.id,
        ...updatedPayload,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Project id is required' }, { status: 400 });
  }

  try {
    await prisma.document.deleteMany({
      where: { id, userId, contentType: 'project_manifest' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
