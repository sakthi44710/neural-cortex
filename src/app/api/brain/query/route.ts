import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { nvidiaChat, nvidiaChatStream, generateConversationTitle, extractTopicFromMessage, generateEmbeddingSimple } from '@/lib/nvidia';
import { cosineSimilarity } from '@/lib/utils';
import {
  runAgents,
  buildAgentSystemPrompt,
  validateResponse,
  type DocumentForRAG,
} from '@/lib/agents';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // List conversations
  if (searchParams.get('list') === 'true') {
    const rawConversations = await prisma.conversation.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        messages: {
          where: { role: 'user' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { content: true },
        },
      },
    });

    // Auto-heal any conversations with "No Topic Specified" or generic titles
    const conversations = await Promise.all(
      rawConversations.map(async (c: any) => {
        const isGeneric =
          !c.title ||
          /^(no topic|untitled|new chat|new conversation|conversation)/i.test(c.title.trim()) ||
          /no topic specified/i.test(c.title);

        if (isGeneric && c.messages && c.messages.length > 0) {
          const firstMsg = c.messages[0].content;
          const healedTitle = extractTopicFromMessage(firstMsg);
          // Asynchronously update in database
          prisma.conversation
            .update({
              where: { id: c.id },
              data: { title: healedTitle },
            })
            .catch(() => {});
          return { id: c.id, title: healedTitle, updatedAt: c.updatedAt };
        }
        return { id: c.id, title: c.title, updatedAt: c.updatedAt };
      })
    );

    return NextResponse.json({ conversations });
  }

  // Load conversation messages
  const conversationId = searchParams.get('conversationId');
  if (conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ messages });
  }

  return NextResponse.json({ conversations: [] });
}

// DELETE conversation and all its messages
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete messages first (cascade), then the conversation
  await prisma.message.deleteMany({ where: { conversationId } });
  await prisma.conversation.delete({ where: { id: conversationId } });

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, conversationId, stream: useStream } = await req.json();
  if (!message) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  // 1. Fetch lightweight metadata first for high-speed scoring
  const docMeta = await prisma.document.findMany({
    where: { userId: session.user.id },
    select: { id: true, title: true, summary: true, embedding: true, domain: true },
  });

  const queryEmbedding = generateEmbeddingSimple(message);
  const queryWords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);

  const scoredMeta = docMeta
    .map((doc: any) => {
      let score = 0;
      const textToMatch = ((doc.title || '') + ' ' + (doc.summary || '') + ' ' + (doc.domain || '')).toLowerCase();
      for (const word of queryWords) {
        if (textToMatch.includes(word)) score += 2;
      }
      if (doc.embedding) {
        try {
          const docEmb = JSON.parse(doc.embedding);
          score += cosineSimilarity(queryEmbedding, docEmb) * 5;
        } catch {}
      }
      return { ...doc, score };
    })
    .sort((a: any, b: any) => b.score - a.score);

  // Take top matched docs (up to 4)
  const topDocs = scoredMeta.slice(0, 4);
  const topIds = topDocs.map((d: any) => d.id);

  // Fetch full content ONLY for the top matched documents
  const fullDocs = topIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: topIds } },
        select: { id: true, title: true, content: true, summary: true, embedding: true },
      })
    : [];

  // Run multi-agent system with the selectively retrieved documents
  const docsForRAG: DocumentForRAG[] = fullDocs.map(
    (d: { id: string; title: string; content: string; summary: string | null; embedding: string | null }) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      summary: d.summary,
      embedding: d.embedding,
    })
  );

  const agentContext = await runAgents(message, docsForRAG);

  // Ingest ONLY the single best matching major diagram node from the user's Knowledge Graph
  const isDiagramQuery = /\b(diagram|diagrams|architecture|flowchart|flow|mermaid|visual|schema|model|process|graph|pipeline)\b/i.test(message);
  if (isDiagramQuery) {
    try {
      const candidateNodes = await prisma.knowledgeNode.findMany({
        where: {
          userId: session.user.id,
          type: 'diagram',
        },
        take: 12,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, label: true, description: true, metadata: true },
      });

      if (candidateNodes.length > 0) {
        // Extract topic keywords excluding common conversational and meta words
        const stopWords = new Set([
          'explain', 'about', 'with', 'diagram', 'diagrams', 'show', 'please', 'the', 'and', 'what',
          'is', 'how', 'does', 'work', 'give', 'some', 'only', 'major', 'details', 'tell', 'more'
        ]);
        const queryWords = message.toLowerCase().split(/[^a-z0-9]+/).filter((w: string) => w.length > 2 && !stopWords.has(w));

        // Score candidates: prioritize topic relevance and major architectural overviews
        const scoredCandidates = candidateNodes.map((node: any) => {
          const labelLower = (node.label || '').toLowerCase();
          const descLower = (node.description || '').toLowerCase();
          let score = 0;

          // Keyword matches
          for (const word of queryWords) {
            if (labelLower.includes(word)) score += 4;
            if (descLower.includes(word)) score += 2;
          }

          // Bonus for high-level / overarching architecture terms
          if (/\b(architecture|overview|system|structure|lifecycle|pipeline|high-level)\b/i.test(labelLower)) {
            score += 5;
          }

          // Penalty for fragmented or minor sub-aspects (disadvantages, sub-storage, etc.)
          if (/\b(disadvantage|disadvantages|limitation|flaw|storage detail|sub|fragment)\b/i.test(labelLower)) {
            score -= 6;
          }

          return { node, score };
        });

        // Filter for candidates that have relevance (score > 0) or fall back to highest if query is generic
        scoredCandidates.sort((a, b) => b.score - a.score);
        const bestCandidate = scoredCandidates[0]?.score > 0 ? scoredCandidates[0].node : (queryWords.length === 0 ? scoredCandidates[0]?.node : null);

        if (bestCandidate) {
          let mermaidCode = '';
          try {
            if (bestCandidate.metadata) {
              const meta = JSON.parse(bestCandidate.metadata);
              if (meta.mermaidCode) {
                mermaidCode = `\n\`\`\`mermaid\n${meta.mermaidCode}\n\`\`\``;
              }
            }
          } catch {}

          if (mermaidCode) {
            agentContext.knowledgeContext = (agentContext.knowledgeContext || '') +
              `\n\n## Reference Major Architectural Diagram From Knowledge Vault:
The user has requested an explanation of the topic with diagrams.
CRITICAL INSTRUCTION:
- You must explain the WHOLE CONCEPT comprehensively in deep written prose (Executive Overview, Architecture, Component Breakdown, Operational Workflows, Guarantees, Trade-offs).
- Include AT MOST ONE (1) major overarching diagram (e.g. System Architecture) using clean Mermaid syntax (\`\`\`mermaid).
- DO NOT dump multiple diagrams for separate sub-topics (do NOT create separate diagrams for components, storage, disadvantages, etc.).
- Explain components, storage, and disadvantages in detailed written paragraphs and markdown comparison tables instead of separate diagrams.
- Walk through the major diagram in depth immediately following it.

Reference Vault Diagram [${bestCandidate.label}]:
${bestCandidate.description || ''}
${mermaidCode}`;

            agentContext.sources.push({
              type: 'diagram',
              title: `Major Architecture Diagram: ${bestCandidate.label}`,
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to load diagram node for RAG:', e);
    }
  }

  // Cross-conversation knowledge: pull relevant messages from OTHER conversations
  let crossConvoContext = '';
  try {
    const otherConversations = await prisma.conversation.findMany({
      where: {
        userId: session.user.id,
        ...(conversationId ? { id: { not: conversationId } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, title: true },
    });

    if (otherConversations.length > 0) {
      const otherMessages = await prisma.message.findMany({
        where: {
          conversationId: { in: otherConversations.map((c: { id: string }) => c.id) },
          role: 'assistant',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { content: true, conversationId: true },
      });

      if (otherMessages.length > 0) {
        // Score messages by keyword relevance to current query
        const queryWords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        const scoredMessages = otherMessages
          .map((m: { content: string; conversationId: string }) => {
            const lower = m.content.toLowerCase();
            let score = 0;
            for (const word of queryWords) {
              if (lower.includes(word)) score++;
            }
            const convTitle = otherConversations.find((c: { id: string; title: string }) => c.id === m.conversationId)?.title || 'Previous chat';
            return { content: m.content, score, convTitle };
          })
          .filter((m: { score: number }) => m.score > 0)
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
          .slice(0, 3);

        if (scoredMessages.length > 0) {
          crossConvoContext = '\n\n## Insights from Previous Conversations:\n\n' +
            scoredMessages
              .map((m: { convTitle: string; content: string }) => `**From "${m.convTitle}":**\n${m.content.slice(0, 500)}`)
              .join('\n\n');
        }
      }
    }
  } catch (err) {
    console.error('Cross-conversation lookup failed:', err);
  }

  // Get or create conversation
  let convo;
  if (conversationId) {
    convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (convo && convo.userId !== session.user.id) {
      convo = null;
    }
  }

  if (!convo) {
    convo = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        title: 'New Conversation',
      },
    });
  }

  // Get conversation history (last 10 messages for context)
  const history = await prisma.message.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  // Generate an intelligent 2-4 word AI topic title for new conversations or raw prompt slices
  const isNew = !conversationId || history.length === 0;
  const needsTitleGeneration =
    isNew ||
    convo.title === 'New Conversation' ||
    convo.title === 'No Topic Specified' ||
    /no topic/i.test(convo.title) ||
    convo.title === message.slice(0, 80) ||
    convo.title.length > 50;

  const titlePromise = needsTitleGeneration
    ? generateConversationTitle(message).catch((err) => {
        console.error('Failed to generate AI title:', err);
        return extractTopicFromMessage(message);
      })
    : null;

  // Save user message
  await prisma.message.create({
    data: {
      conversationId: convo.id,
      role: 'user',
      content: message,
    },
  });

  // Build agent-enriched system prompt with knowledge base, web search, and YouTube results
  const systemPrompt = buildAgentSystemPrompt(agentContext, crossConvoContext);

  const aiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // Combine sources from all agents (documents, web search, YouTube)
  const sources = agentContext.sources;

  // Streaming response (temperature 0.1 for deterministic, consistent answers)
  if (useStream) {
    try {
      const aiStream = await nvidiaChatStream({
        messages: aiMessages,
        maxTokens: 3500,
        temperature: 0.1,
      });

      let fullResponse = '';
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        async transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          // Extract content from SSE data
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                // Resolve AI title if pending
                let finalTitle = convo!.title;
                if (titlePromise) {
                  try {
                    const aiTitle = await titlePromise;
                    if (aiTitle) {
                      finalTitle = aiTitle;
                      await prisma.conversation.update({
                        where: { id: convo!.id },
                        data: { title: aiTitle },
                      });
                    }
                  } catch (e) {
                    console.error('Failed to update conversation title in stream:', e);
                  }
                }

                // Send metadata at end including the AI conversationTitle
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      done: true,
                      conversationId: convo!.id,
                      conversationTitle: finalTitle,
                      sources,
                    })}\n\n`
                  )
                );
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullResponse += parsed.content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: parsed.content })}\n\n`));
                }
              } catch {}
            }
          }
        },
        async flush() {
          // Save the assistant response to DB
          if (fullResponse) {
            await prisma.message.create({
              data: {
                conversationId: convo!.id,
                role: 'assistant',
                content: fullResponse,
                sources: JSON.stringify(sources),
              },
            });
            await prisma.conversation.update({
              where: { id: convo!.id },
              data: { updatedAt: new Date() },
            });
          }
        },
      });

      const readable = aiStream.pipeThrough(transformStream);

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      console.error('Streaming error, falling back to non-stream:', error);
      // Fall through to non-streaming
    }
  }

  // Non-streaming response with deterministic temperature and multi-model fact-check validation
  try {
    const rawResponse = await nvidiaChat({
      messages: aiMessages,
      maxTokens: 3500,
      temperature: 0.1,
    });

    // Cross-validate with HuggingFace model to reduce hallucination
    const validationContext = [agentContext.knowledgeContext, agentContext.searchContext, agentContext.youtubeContext].filter(Boolean).join('\n\n');
    const response = await validateResponse(message, rawResponse, validationContext);

    // Save assistant message
    await prisma.message.create({
      data: {
        conversationId: convo.id,
        role: 'assistant',
        content: response,
        sources: JSON.stringify(sources),
      },
    });

    let finalTitle = convo.title;
    if (titlePromise) {
      try {
        const aiTitle = await titlePromise;
        if (aiTitle) {
          finalTitle = aiTitle;
          await prisma.conversation.update({
            where: { id: convo.id },
            data: { title: aiTitle, updatedAt: new Date() },
          });
        }
      } catch (e) {
        console.error('Failed to update title:', e);
      }
    } else {
      await prisma.conversation.update({
        where: { id: convo.id },
        data: { updatedAt: new Date() },
      });
    }

    return NextResponse.json({
      response,
      conversationId: convo.id,
      conversationTitle: finalTitle,
      sources,
    });
  } catch (error) {
    console.error('NVIDIA API error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        response: `I encountered an error: ${errMsg}. Please try again in a moment.`,
        conversationId: convo.id,
        conversationTitle: convo.title,
        sources: [],
      },
      { status: 200 } // return 200 so frontend shows the message
    );
  }
}
