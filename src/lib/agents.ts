/**
 * Multi-Model Agent System (Mixture of Experts)
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │                    User Query                           │
 * │                       ↓                                 │
 * │              Intent Classifier                          │
 * │         (keyword + pattern matching)                    │
 * │                       ↓                                 │
 * │    ┌──────────┬──────────┬──────────┬──────────┐       │
 * │    ↓          ↓          ↓          ↓          ↓       │
 * │ Knowledge  Web Search  YouTube  Summarize  General     │
 * │  Expert     Expert     Expert    Expert    Expert       │
 * │ (NVIDIA)  (DuckDuckGo) (DDG)    (NVIDIA   (NVIDIA)    │
 * │              ↓          ↓       + HF BART)             │
 * │    └──────────┴──────────┴──────────┴──────────┘       │
 * │                       ↓                                 │
 * │           Context Aggregator                            │
 * │                       ↓                                 │
 * │        Primary Response (NVIDIA LLM)                    │
 * │                       ↓                                 │
 * │       Fact-Check Validator (HuggingFace)                │
 * │                       ↓                                 │
 * │             Final Response                              │
 * └─────────────────────────────────────────────────────────┘
 *
 * Models Used:
 * NVIDIA  → Llama 3.2 Vision (primary), Nemotron 3 / GPT-OSS (fallbacks)
 * HF      → Mistral 7B (validation), BART (summarization), Whisper (audio)
 */

import {
  webSearch,
  youtubeSearch,
  formatSearchResultsForContext,
  formatYouTubeResultsForContext,
  type SearchResult,
  type YouTubeResult,
} from './search';
import { hfChat, hfSummarize, isHuggingFaceConfigured } from './huggingface';
import { nvidiaChat, generateSummary, generateEmbeddingSimple } from './nvidia';
import { cosineSimilarity } from './utils';

// ─── Types ─────────────────────────────────────────────────

export type ExpertType = 'knowledge' | 'search' | 'youtube' | 'summarize' | 'general';

export interface AgentContext {
  knowledgeContext: string;
  searchResults: SearchResult[];
  youtubeResults: YouTubeResult[];
  searchContext: string;
  youtubeContext: string;
  sources: { type: string; title: string; url?: string }[];
  expertsUsed: ExpertType[];
}

export interface DocumentForRAG {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  embedding: string | null;
}

// ─── Intent Classifier ────────────────────────────────────

const SEARCH_PATTERNS = [
  /\b(search|find|look up|google|what is|who is|latest|current|news|when did|where is|how to)\b/i,
  /\b(tell me about|explain|define|meaning of|definition)\b/i,
  /\?([\s]*$)/,
];

const YOUTUBE_PATTERNS = [
  /\b(youtube|video|watch|tutorial|lecture|course|playlist)\b/i,
  /\b(show me a video|find a video|video about|video on|video for)\b/i,
  /\b(how to .+ video|learn .+ video)\b/i,
];

const SUMMARIZE_PATTERNS = [
  /\b(summarize|summary|brief|overview|recap|tldr|tl;dr)\b/i,
  /\b(what does .+ say|key points|main ideas|highlight)\b/i,
];

const KNOWLEDGE_PATTERNS = [
  /\b(my document|my notes|my file|uploaded|in my vault|knowledge base|my .+ says)\b/i,
  /\b(from my|according to my|in my|remember when)\b/i,
];

export function classifyIntent(message: string): ExpertType[] {
  const intents: ExpertType[] = [];
  const lowerMsg = message.toLowerCase();

  // Always include knowledge lookup
  intents.push('knowledge');

  // Check for YouTube intent
  if (YOUTUBE_PATTERNS.some((p) => p.test(message))) {
    intents.push('youtube');
  }

  // Check for web search intent
  if (SEARCH_PATTERNS.some((p) => p.test(message))) {
    intents.push('search');
  }

  // Check for summarization intent
  if (SUMMARIZE_PATTERNS.some((p) => p.test(message))) {
    intents.push('summarize');
  }

  // If only knowledge was added and it's a general question, add search too
  if (
    intents.length === 1 &&
    !KNOWLEDGE_PATTERNS.some((p) => p.test(message)) &&
    lowerMsg.includes('?')
  ) {
    intents.push('search');
  }

  return Array.from(new Set(intents));
}

// ─── Knowledge Expert ──────────────────────────────────────

export function runKnowledgeExpert(
  message: string,
  documents: DocumentForRAG[]
): { context: string; sources: { type: string; title: string; url?: string }[] } {
  const queryEmbedding = generateEmbeddingSimple(message);

  const scoredDocs = documents
    .map((doc) => {
      let score = 0;

      // Keyword matching
      const queryWords = message
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      const content = (
        doc.content +
        ' ' +
        doc.title +
        ' ' +
        (doc.summary || '')
      ).toLowerCase();

      for (const word of queryWords) {
        if (content.includes(word)) score += 1;
      }

      // Embedding similarity
      if (doc.embedding) {
        try {
          const docEmb = JSON.parse(doc.embedding);
          score += cosineSimilarity(queryEmbedding, docEmb) * 5;
        } catch {}
      }

      return { ...doc, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .filter((d) => d.score > 0);

  const context = scoredDocs
    .map(
      (d) =>
        `### ${d.title}\n${d.summary || d.content.slice(0, 1500)}`
    )
    .join('\n\n');

  const sources = scoredDocs.map((d) => ({
    type: 'document',
    title: d.title,
  }));

  return { context, sources };
}

// ─── Search Expert ─────────────────────────────────────────

export async function runSearchExpert(
  message: string
): Promise<{ results: SearchResult[]; context: string }> {
  try {
    const results = await webSearch(message, 5);
    const context = formatSearchResultsForContext(results);
    return { results, context };
  } catch (err) {
    console.error('[Agent] Search expert failed:', err);
    return { results: [], context: '' };
  }
}

// ─── YouTube Expert ────────────────────────────────────────

export async function runYouTubeExpert(
  message: string
): Promise<{ results: YouTubeResult[]; context: string }> {
  try {
    // Strip "youtube" from query to get better search results
    const cleanQuery = message
      .replace(/\b(youtube|video|find|show|me|a)\b/gi, '')
      .trim();
    const results = await youtubeSearch(cleanQuery || message, 5);
    const context = formatYouTubeResultsForContext(results);
    return { results, context };
  } catch (err) {
    console.error('[Agent] YouTube expert failed:', err);
    return { results: [], context: '' };
  }
}

// ─── Multi-Model Consensus Summarizer ──────────────────────

export async function consensusSummarize(text: string): Promise<string> {
  // Run summarization on both NVIDIA and HuggingFace in parallel
  const [nvidiaSummary, hfSummaryResult] = await Promise.allSettled([
    generateSummary(text),
    isHuggingFaceConfigured() ? hfSummarize(text) : Promise.resolve(''),
  ]);

  const summary1 =
    nvidiaSummary.status === 'fulfilled' ? nvidiaSummary.value : '';
  const summary2 =
    hfSummaryResult.status === 'fulfilled' ? hfSummaryResult.value : '';

  // If only one model produced results, use that
  if (!summary1 && summary2) return summary2;
  if (summary1 && !summary2) return summary1;
  if (!summary1 && !summary2) return '';

  // Both models produced summaries — merge with consensus
  try {
    const mergedSummary = await nvidiaChat({
      messages: [
        {
          role: 'system',
          content:
            'You are a fact-checker. Given two independent AI summaries of the same text, produce a single accurate summary. Keep ONLY facts that BOTH summaries agree on. If they contradict each other, state only what is certain. Be concise (2-3 sentences).',
        },
        {
          role: 'user',
          content: `Summary from Model A:\n${summary1}\n\nSummary from Model B:\n${summary2}\n\nProduce a merged, fact-checked summary:`,
        },
      ],
      maxTokens: 300,
      temperature: 0.1,
    });
    return mergedSummary;
  } catch {
    return summary1; // Fallback to NVIDIA summary
  }
}

// ─── Fact-Check Validator ──────────────────────────────────

export async function validateResponse(
  question: string,
  response: string,
  context: string
): Promise<string> {
  if (!isHuggingFaceConfigured()) return response;

  try {
    // 4 second timeout so fact check never blocks or delays user response
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Validation timeout')), 4000)
    );

    const validationPromise = hfChat({
      messages: [
        {
          role: 'system',
          content: `You are a fact-checker. Given a question, an AI response, and source context, identify any claims in the response that are NOT supported by the provided context. 
If the response is well-supported, reply: "VALIDATED"
If there are unsupported claims, reply: "ISSUES: [list the specific unsupported claims]"
Be brief.`,
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nAI Response: ${response.slice(0, 1500)}\n\nSource Context: ${context.slice(0, 2000)}`,
        },
      ],
      maxTokens: 300,
      temperature: 0.1,
    });

    const validation = await Promise.race([validationPromise, timeoutPromise]);

    if (validation.includes('VALIDATED') || !validation.includes('ISSUES')) {
      return response;
    }

    // Add a disclaimer about uncertain claims
    console.log('[Agent] Fact-check found issues:', validation);
    return response + '\n\n> ⚠️ *Some claims in this response may need verification. Cross-reference with your source documents for accuracy.*';
  } catch (err) {
    // Fail silently and fast
    return response;
  }
}

// ─── Master Agent Orchestrator ─────────────────────────────

export async function runAgents(
  message: string,
  documents: DocumentForRAG[]
): Promise<AgentContext> {
  const intents = classifyIntent(message);
  console.log(`[Agent] Intents classified: ${intents.join(', ')}`);

  // Knowledge expert always runs synchronously (fast, local)
  const knowledgeResult = runKnowledgeExpert(message, documents);

  // Run async experts in parallel
  const asyncTasks: Promise<any>[] = [];
  const taskMap: Record<string, number> = {};

  if (intents.includes('search')) {
    taskMap['search'] = asyncTasks.length;
    asyncTasks.push(runSearchExpert(message));
  }

  if (intents.includes('youtube')) {
    taskMap['youtube'] = asyncTasks.length;
    asyncTasks.push(runYouTubeExpert(message));
  }

  const asyncResults = await Promise.allSettled(asyncTasks);

  // Aggregate results
  const searchResult =
    taskMap['search'] !== undefined &&
    asyncResults[taskMap['search']]?.status === 'fulfilled'
      ? (asyncResults[taskMap['search']] as PromiseFulfilledResult<any>).value
      : { results: [], context: '' };

  const youtubeResult =
    taskMap['youtube'] !== undefined &&
    asyncResults[taskMap['youtube']]?.status === 'fulfilled'
      ? (asyncResults[taskMap['youtube']] as PromiseFulfilledResult<any>).value
      : { results: [], context: '' };

  // Build sources list
  const sources = [
    ...knowledgeResult.sources,
    ...searchResult.results.map((r: SearchResult) => ({
      type: 'web',
      title: r.title,
      url: r.url,
    })),
    ...youtubeResult.results.map((r: YouTubeResult) => ({
      type: 'youtube',
      title: r.title,
      url: r.url,
    })),
  ];

  return {
    knowledgeContext: knowledgeResult.context,
    searchResults: searchResult.results,
    youtubeResults: youtubeResult.results,
    searchContext: searchResult.context,
    youtubeContext: youtubeResult.context,
    sources,
    expertsUsed: intents,
  };
}

// ─── Build System Prompt from Agent Context ────────────────

export function buildAgentSystemPrompt(
  agentContext: AgentContext,
  crossConvoContext: string = ''
): string {
  const sections: string[] = [];

  // Core identity
  sections.push(
    `You are Neural Cortex, a state-of-the-art AI knowledge intelligence platform and cognitive twin powered by high-performance neural models and dynamic knowledge retrieval. You deliver authoritative, exhaustive, beautifully structured responses comparable to the best capabilities of modern frontier AI assistants.`
  );

  // Knowledge base context
  if (agentContext.knowledgeContext) {
    sections.push(
      `## Ground Truth Knowledge Base (User's Vault Documents):\n\n${agentContext.knowledgeContext}`
    );
  }

  // Web search results
  if (agentContext.searchContext) {
    sections.push(agentContext.searchContext);
  }

  // YouTube results
  if (agentContext.youtubeContext) {
    sections.push(agentContext.youtubeContext);
  }

  // Cross-conversation memory
  if (crossConvoContext) {
    sections.push(crossConvoContext);
  }

  // Instructions
  sections.push(`## Comprehensive Response & Presentation Guidelines:

1. **Deterministic Consistency & Grounding**:
   - Provide definitive, consistent answers grounded firmly in the user's knowledge base and provided sources.
   - When asked the same or equivalent question repeatedly, maintain the same core facts, conclusions, and structured depth. Answers should only evolve or change when new notes, concepts, or documents are added to the knowledge vault.
   - When referencing user documents, explicitly cite their titles.

2. **Interactive Diagrams & Visual Models (CRITICAL)**:
   - When explaining workflows, architectures, pipelines, lifecycle stages, system components, mindmaps, or relationships, GENERATE interactive Mermaid diagrams in markdown code blocks (\`\`\`mermaid).
   - The user interface automatically compiles these into dynamic visual graphics with zoom, pan, copy, and fullscreen inspection!
   - SYNTAX RULES FOR ZERO ERRORS:
     * ALWAYS enclose node labels in double quotes inside brackets: e.g. A["User Request (SQL)"] --> B["Query Parser & Lexer"], NOT A[User Request (SQL)]. Unquoted parentheses, brackets, or slashes inside labels cause syntax errors.
     * Keep node IDs simple: A, B, C, D1, D2.
     * Examples:
       - Flowchart: \`\`\`mermaid
graph TD
  A["User Query"] --> B["Query Parser"]
  B --> C["Query Optimizer"]
  C --> D["Storage Engine"]
\`\`\`
       - Sequence: \`\`\`mermaid
sequenceDiagram
  Client->>Server: Request Data
  Server-->>Client: Return JSON
\`\`\`


3. **Advanced Visual Styling & Layout**:
   - Use comparison tables for features, pros/cons, or metrics (\`| Metric | Approach A | Approach B |\`).
   - Use GitHub-style alert callouts to emphasize key takeaways:
     > [!NOTE]
     > Helpful contextual note or detail.
     > [!TIP]
     > Pro-tip or best practice recommendation.
     > [!IMPORTANT]
     > Critical takeaway or key fact.
     > [!WARNING]
     > Potential pitfall or edge case.
   - Use fenced code blocks with proper language identifiers for code, commands, or data formats.
   - For web search and YouTube results, always output markdown hyperlinks ([Title](url)).

4. **Tone & Depth**:
   - Highly articulate, clear, organized with section headers (\`###\`), concise bullets, and deep conceptual precision.`);

  return sections.join('\n\n');
}
