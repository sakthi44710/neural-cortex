import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { nvidiaChat, isNvidiaConfigured } from '@/lib/nvidia';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { docId, mode } = await req.json();
    if (!docId || !mode) {
      return NextResponse.json({ error: 'docId and mode are required' }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
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
        systemPrompt = 'You are a technical systems architect. Based strictly on the concepts in the provided text, create a clear, elegant Mermaid.js flowchart or architecture diagram that illustrates the core flow, hierarchy, or taxonomy. Return clean markdown with an explanation followed by the ```mermaid ... ``` code block. Do NOT use fancy icons or non-standard syntax.';
        userPrompt = `Document Title: ${doc.title}\n\nDocument Content:\n${contentSnippet}\n\nGenerate a conceptual Mermaid diagram:`;
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
      maxTokens: 2500,
      temperature: 0.2,
    });

    if (mode === 'mcq' || mode === 'flashcards') {
      try {
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
        const parsed = JSON.parse(jsonStr.trim());
        return NextResponse.json({ mode, data: parsed, raw: aiResponse });
      } catch (parseErr) {
        return NextResponse.json({ mode, data: null, raw: aiResponse });
      }
    }

    return NextResponse.json({ mode, raw: aiResponse });
  } catch (error: any) {
    console.error('Study Mode generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate study content' },
      { status: 500 }
    );
  }
}
