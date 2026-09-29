import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nvidiaChat, isNvidiaConfigured } from '@/lib/nvidia';
import { hfChat, isHuggingFaceConfigured } from '@/lib/huggingface';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, content, instruction = '', tone = 'technical' } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    let prompt = '';
    switch (action) {
      case 'rewrite':
        prompt = `Rewrite and polish the following content to enhance clarity, flow, and technical elegance while preserving its core factual meaning:\n\n${content}`;
        break;
      case 'expand':
        prompt = `Expand the following content with deeper technical detail, practical examples, architecture trade-offs, and clear structure:\n\n${content}`;
        break;
      case 'summarize':
        prompt = `Provide a concise, high-density executive summary of the following content in markdown bullet points:\n\n${content}`;
        break;
      case 'change_tone':
        prompt = `Transform the tone of the following content into a ${tone} tone (${
          tone === 'academic'
            ? 'rigorous, scholarly, formal'
            : tone === 'concise'
            ? 'terse, high signal-to-noise ratio, minimal fluff'
            : 'clear, pedagogical, instructional'
        }):\n\n${content}`;
        break;
      case 'custom':
        prompt = `Apply the following instruction to the content:\nInstruction: ${instruction}\n\nContent:\n${content}`;
        break;
      default:
        prompt = `Improve the following markdown artifact content:\n\n${content}`;
    }

    let modified = '';
    const messages = [
      {
        role: 'system' as const,
        content:
          'You are the Artifact Editor Engine of Neural Cortex 2.0. Return only the revised markdown content with no conversational pleasantries or preamble.',
      },
      { role: 'user' as const, content: prompt },
    ];

    if (isNvidiaConfigured()) {
      modified = await nvidiaChat({ messages, temperature: 0.3, maxTokens: 4096 });
    } else if (isHuggingFaceConfigured()) {
      modified = await hfChat({ messages, temperature: 0.3, maxTokens: 4096 });
    } else {
      return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 });
    }

    return NextResponse.json({ result: modified.trim() });
  } catch (error: any) {
    console.error('Artifact action failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process artifact' }, { status: 500 });
  }
}
