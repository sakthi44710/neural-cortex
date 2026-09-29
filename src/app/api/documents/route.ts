import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');
  const includeContent = searchParams.get('includeContent') === 'true';

  // If specific document requested, fetch full content
  if (docId) {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });
    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ document: doc });
  }

  // Listing query: exclude heavy content and embedding fields for ultra-fast response
  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      title: true,
      fileUrl: true,
      fileType: true,
      fileSize: true,
      summary: true,
      domain: true,
      tags: true,
      contentType: true,
      keyPoints: true,
      entities: true,
      createdAt: true,
      updatedAt: true,
      accessCount: true,
      ...(includeContent ? { content: true } : {}),
    },
  });

  return NextResponse.json({ documents });
}

export async function DELETE(req: NextRequest) {
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

  await prisma.document.delete({ where: { id: docId } });
  return NextResponse.json({ success: true });
}
