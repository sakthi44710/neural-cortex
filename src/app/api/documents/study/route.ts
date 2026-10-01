import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { nvidiaChat, isNvidiaConfigured } from '@/lib/nvidia';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('docId');
    if (!docId) {
      return NextResponse.json({ error: 'docId is required' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, userId: true },
    });

    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Fetch all saved study artifacts for this document
    const artifacts = await prisma.knowledgeNode.findMany({
      where: {
        userId: session.user.id,
        type: 'study_artifact',
        label: docId,
      },
    });

    const studyData: Record<string, { raw: string; data?: any; updatedAt?: string }> = {};
    for (const art of artifacts) {
      if (art.description && art.metadata) {
        try {
          const parsed = JSON.parse(art.metadata);
          studyData[art.description] = {
            raw: parsed.raw,
            data: parsed.data,
            updatedAt: art.updatedAt.toISOString(),
          };
        } catch {
          studyData[art.description] = { raw: art.metadata, updatedAt: art.updatedAt.toISOString() };
        }
      }
    }

    return NextResponse.json({ studyData });
  } catch (error: any) {
    console.error('Failed to load cached study artifacts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load study artifacts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { docId, mode, redefine } = await req.json();
    if (!docId || !mode) {
      return NextResponse.json({ error: 'docId and mode are required' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if previously generated and cached in KnowledgeNode
    const existingNode = await prisma.knowledgeNode.findFirst({
      where: {
        userId: session.user.id,
        type: 'study_artifact',
        label: docId,
        description: mode,
      },
    });

    // If not redefining and cached artifact exists, return immediately (saves API credits!)
    if (existingNode && !redefine && existingNode.metadata) {
      try {
        const parsed = JSON.parse(existingNode.metadata);
        return NextResponse.json({
          mode,
          data: parsed.data,
          raw: parsed.raw,
          cached: true,
          updatedAt: existingNode.updatedAt.toISOString(),
        });
      } catch {
        // If metadata was corrupted, continue to regenerate
      }
    }

    const contentSnippet = doc.content.slice(0, 12000); // Up to ~3000 tokens for optimal processing

    if (!isNvidiaConfigured()) {
      return NextResponse.json({
        error: 'AI provider is not configured. Please set NVIDIA_API_KEY in environment variables.',
      }, { status: 503 });
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (mode) {
      case '2-mark':
        systemPrompt = 'You are an academic exam specialist. Generate five 2-mark university-style conceptual and definition questions based STRICTLY on the provided text. Provide a crisp, authoritative 2-line model answer for each question. Return clean markdown formatted with ## Questions & Answers.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate 5 high-yield 2-mark questions and answers:`;
        break;

      case '5-mark':
        systemPrompt = 'You are an academic professor. Generate three 5-mark structured explanation questions based STRICTLY on the provided text. For each question, provide a structured model answer with: 1. Core definition, 2. Key components or working principles (in bullets), 3. Practical example or significance. Return clean markdown formatted.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate 3 structured 5-mark exam questions and model answers:`;
        break;

      case '10-mark':
        systemPrompt = 'You are a senior academic university examiner. Generate two comprehensive 10-mark in-depth analytical questions based STRICTLY on the provided text. Provide complete model answers with introduction, detailed sub-sections, architecture/mechanisms, trade-offs/comparisons, and conclusion. Return clean markdown formatted.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate 2 comprehensive 10-mark university exam questions with full model answers:`;
        break;

      case 'mcq':
        systemPrompt = 'You are an assessment specialist. Generate 5 multiple-choice questions (MCQs) based strictly on the provided text. Return a JSON array with objects containing: question (string), options (array of 4 strings), answer (string - exact text of correct option), explanation (string). Return ONLY the raw JSON array wrapped in ```json ... ```.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate 5 rigorous MCQs:`;
        break;

      case 'flashcards':
        systemPrompt = 'You are a cognitive memory and learning coach. Generate 6 active-recall flashcards based strictly on the provided text. Return a JSON array of objects with "front" (concise term, question, or scenario) and "back" (clear, high-density explanation or key points). Return ONLY the raw JSON array wrapped in ```json ... ```.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate 6 active-recall flashcards:`;
        break;

      case 'diagram':
        systemPrompt = 'You are a principal systems architect and technical educator. Based strictly on the concepts in the provided text, create: 1. A clear, comprehensive conceptual and architectural explanation of the entire system, its motivation, components, and data flow. 2. Exactly ONE (1) clean, valid major overarching Mermaid.js architecture diagram using ```mermaid ... ``` (ensure node labels are in double quotes: A["Label"] --> B["Label"]; do NOT output multiple diagrams). 3. A detailed component-by-component written breakdown explaining what each block does and its operational significance. Return clean, rich markdown with substantial conceptual prose.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate a conceptual Mermaid diagram and comprehensive architectural breakdown:`;
        break;

      case 'study-guide':
      default:
        systemPrompt = 'You are an elite educational researcher. Create a comprehensive, well-structured Study Guide from the provided document. Include: 1. Executive Summary, 2. Core Concepts & Definitions, 3. Key Methodologies & Architectural Flows, 4. Critical Exam Pitfalls & FAQs, 5. Rapid Revision Checklist. Return clean markdown with clear headings.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate the complete Study Guide:`;
        break;
    }

    const aiResponse = await nvidiaChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 3000,
      temperature: 0.2,
    });

    let parsedData = null;
    if (mode === 'mcq' || mode === 'flashcards') {
      try {
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
        parsedData = JSON.parse(jsonStr.trim());
      } catch (parseErr) {
        console.warn('Failed to parse structured JSON for study mode:', parseErr);
      }
    }

    // Persist to KnowledgeNode so future visits load instantly without calling the AI API
    const artifactPayload = JSON.stringify({
      mode,
      raw: aiResponse,
      data: parsedData,
    });

    try {
      if (existingNode) {
        await prisma.knowledgeNode.update({
          where: { id: existingNode.id },
          data: {
            metadata: artifactPayload,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.knowledgeNode.create({
          data: {
            userId: session.user.id,
            type: 'study_artifact',
            label: docId,
            description: mode,
            metadata: artifactPayload,
          },
        });
      }
    } catch (saveErr) {
      console.error('Failed to save study artifact cache:', saveErr);
    }

    return NextResponse.json({
      mode,
      data: parsedData,
      raw: aiResponse,
      cached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Study Mode generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate study content' },
      { status: 500 }
    );
  }
}
