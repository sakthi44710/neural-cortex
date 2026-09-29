const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

function getNvidiaApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error('NVIDIA_API_KEY is not configured');
  }
  return key;
}

export function isNvidiaConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY;
}

// Verified active models (fast, reliable) with automatic fallbacks
const MODELS = [
  'meta/llama-3.2-11b-vision-instruct',
  'meta/llama-3.2-90b-vision-instruct',
  'nvidia/nemotron-4-340b-instruct',
  'mistralai/mistral-nemo-12b-instruct',
];

const REQUEST_TIMEOUT = 35_000; // 35 seconds to allow deep synthesis without aborting

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  model?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function nvidiaChat(options: ChatOptions): Promise<string> {
  const {
    messages,
    maxTokens = 4096,
    temperature = 0.1, // Low temperature for consistent, deterministic answers
    model,
  } = options;

  const apiKey = getNvidiaApiKey();
  const modelsToTry = model ? [model, ...MODELS] : MODELS;
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    try {
      const response = await fetchWithTimeout(
        NVIDIA_API_URL,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            top_p: 1.0,
            stream: false,
          }),
        },
        REQUEST_TIMEOUT,
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`NVIDIA API error (${currentModel}):`, response.status, error);
        lastError = new Error(`NVIDIA API error: ${response.status}`);
        continue; // try next model
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error('Empty response from AI');
        continue;
      }
      return content;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Model ${currentModel} failed:`, msg);
      lastError = err instanceof Error ? err : new Error(msg);
      continue; // try next model
    }
  }

  throw lastError || new Error('All AI models failed');
}

// Streaming chat — returns a ReadableStream of SSE chunks with fallback support
export async function nvidiaChatStream(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
  const {
    messages,
    maxTokens = 4096,
    temperature = 0.1, // Low temperature for deterministic, consistent responses
    model,
  } = options;

  const apiKey = getNvidiaApiKey();
  const modelsToTry = model ? [model, ...MODELS] : MODELS;
  let response: Response | null = null;
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    try {
      const res = await fetchWithTimeout(
        NVIDIA_API_URL,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            top_p: 1.0,
            stream: true,
          }),
        },
        REQUEST_TIMEOUT,
      );

      if (!res.ok) {
        const error = await res.text();
        console.error(`NVIDIA API stream error (${currentModel}):`, res.status, error);
        lastError = new Error(`NVIDIA API stream error ${res.status}: ${error}`);
        continue;
      }

      if (!res.body) {
        lastError = new Error('No response body for streaming');
        continue;
      }

      response = res;
      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Model ${currentModel} stream failed:`, msg);
      lastError = err instanceof Error ? err : new Error(msg);
      continue;
    }
  }

  if (!response || !response.body) {
    throw lastError || new Error('All AI streaming models failed');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') break;
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {}
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Retain any partial trailing line for next chunk

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {
              // skip unparseable chunks
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

/**
 * Fast rule-based topic extraction from user messages:
 * e.g. "show me an diagram of the DBMS workflow" -> "DBMS Workflow Diagram"
 * "explain maths notes sem4.pdf" -> "Maths Notes Sem4"
 * "tell about the two pdf's i have uploaded" -> "Uploaded Documents Overview"
 */
export function extractTopicFromMessage(msg: string): string {
  if (!msg || !msg.trim()) return 'New Conversation';

  let text = msg.trim();
  const isAskingDiagram = /\b(diagram|flowchart|architecture|visual|workflow)\b/i.test(text);

  // Remove common polite or conversational prefixes
  text = text.replace(
    /^(please\s+)?(can you\s+)?(could you\s+)?(i want you to\s+)?(show me|give me|draw|create|make|generate|explain|tell me about|tell about|summarize|what is|what are|how to|how does)\s+(an?\s+|the\s+)?/i,
    ''
  );

  // Remove "diagram of", "overview of", "explanation of"
  text = text.replace(
    /^(diagram\s+of|overview\s+of|explanation\s+of|workflow\s+of|architecture\s+of)\s+(the\s+|an?\s+)?/i,
    ''
  );

  // Strip punctuation and special chars
  text = text.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  // Pick first 3-5 words
  const words = text.split(' ').filter(Boolean).slice(0, 4);
  if (words.length === 0) return 'New Conversation';

  // Capitalize each word (preserving uppercase abbreviations like DBMS, SQL, AI, API)
  let title = words
    .map((w) => (w.toUpperCase() === w && w.length <= 4 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

  // If user requested diagram and title doesn't contain "Diagram", append it
  if (isAskingDiagram && !/\bdiagram\b/i.test(title)) {
    title = `${title} Diagram`;
  }

  return title;
}

/**
 * AI-powered conversation title generator:
 * Produces clean, descriptive 2-4 word titles in Title Case with deterministic extraction fallback.
 */
export async function generateConversationTitle(userMessage: string, assistantSnippet?: string): Promise<string> {
  const smartFallback = extractTopicFromMessage(userMessage);

  try {
    const prompt = assistantSnippet
      ? `User query: "${userMessage.slice(0, 250)}"\nAI answer excerpt: "${assistantSnippet.slice(0, 200)}"`
      : `User query: "${userMessage.slice(0, 300)}"`;

    const title = await nvidiaChat({
      messages: [
        {
          role: 'system',
          content: `You are an AI conversation taxonomist. Create a specific, concise title (2 to 4 words) capturing the main subject.
Strict Rules:
- Return ONLY the 2-4 word Title in Title Case. No quotes, no prefix like "Title:", no punctuation.
- NEVER return generic filler like "No Topic Specified", "New Conversation", "User Question", "General Discussion", or "Untitled".
Examples:
User query: "show me an diagram of the DBMS workflow" -> DBMS Workflow Diagram
User query: "explain backpropagation in neural networks" -> Neural Network Backpropagation
User query: "compare postgresql vs mongodb" -> PostgreSQL vs MongoDB`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      maxTokens: 25,
      temperature: 0.1,
    });

    const cleaned = title
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^(Title|Topic|Subject):\s*/i, '')
      .replace(/[.\n\r]+$/, '')
      .trim();

    const isGeneric =
      !cleaned ||
      cleaned.length < 3 ||
      /^(no topic|untitled|new chat|new conversation|conversation|discussion|query|question|general|unspecified)/i.test(cleaned) ||
      /no topic specified/i.test(cleaned);

    return !isGeneric && cleaned.length <= 60 ? cleaned : smartFallback;
  } catch (err) {
    console.error('[NVIDIA] Failed to generate AI title, using fallback:', err);
    return smartFallback;
  }
}


export async function generateSummary(text: string): Promise<string> {
  const truncated = text.slice(0, 6000);
  return nvidiaChat({
    messages: [
      {
        role: 'system',
        content: 'You are a summarization expert. Provide a concise, informative summary of the given text in 2-3 sentences. Include key points and main ideas.',
      },
      { role: 'user', content: truncated },
    ],
    maxTokens: 300,
    temperature: 0.3,
  });
}

export interface TypedEntity {
  name: string;
  type: 'concept' | 'entity' | 'idea';
}

export async function extractEntities(text: string): Promise<string[]> {
  const typed = await extractEntitiesWithTypes(text);
  return typed.map(e => e.name);
}

export async function extractEntitiesWithTypes(text: string): Promise<TypedEntity[]> {
  const truncated = text.slice(0, 4000);
  try {
    const response = await nvidiaChat({
      messages: [
        {
          role: 'system',
          content: `Extract key entities from the text and classify each into one of these types:
- "entity": Specific named things — people, organizations, products, places, technologies, tools (e.g. Google, PostgreSQL, Elon Musk)
- "concept": Abstract topics, fields, methodologies, theories (e.g. Machine Learning, Normalization, ACID Properties)
- "idea": Opinions, insights, proposals, hypotheses, arguments (e.g. "data should be normalized", "NoSQL is better for scale")

Return ONLY a JSON array of objects with "name" and "type" fields.
Example: [{"name":"React","type":"entity"},{"name":"Machine Learning","type":"concept"},{"name":"Components should be pure","type":"idea"}]
No explanations, no markdown.`,
        },
        { role: 'user', content: truncated },
      ],
      maxTokens: 1024,
      temperature: 0.1,
    });

    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((e: any) => e && e.name && typeof e.name === 'string' && e.name.trim().length > 0)
        .map((e: any) => ({
          name: e.name.trim(),
          type: ['concept', 'entity', 'idea'].includes(String(e.type).toLowerCase()) ? String(e.type).toLowerCase() as 'concept' | 'entity' | 'idea' : 'entity',
        }))
        .slice(0, 20);
    }
    return [];
  } catch {
    return [];
  }
}

export async function extractKeyPoints(text: string): Promise<string[]> {
  const truncated = text.slice(0, 4000);
  try {
    const response = await nvidiaChat({
      messages: [
        {
          role: 'system',
          content: 'Extract the key points from the given text. Return ONLY a JSON array of strings. Example: ["Point one", "Point two"]. No explanations.',
        },
        { role: 'user', content: truncated },
      ],
      maxTokens: 1024,
      temperature: 0.2,
    });

    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function generateEmbeddingSimple(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const dim = 128;
  const embedding = new Array(dim).fill(0);

  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const idx = (word.charCodeAt(i) * (i + 1) * 7) % dim;
      embedding[idx] += 1;
    }
  }

  const norm = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
  return norm > 0 ? embedding.map((v: number) => v / norm) : embedding;
}

/**
 * Extract text from images using NVIDIA vision API (OCR)
 */
export async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    const apiKey = getNvidiaApiKey();

    // Convert buffer to base64
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const visionModels = [
      'meta/llama-3.2-11b-vision-instruct',
      'meta/llama-3.2-90b-vision-instruct',
    ];

    let extractedText = '';

    for (const model of visionModels) {
      try {
        const response = await fetchWithTimeout(
          NVIDIA_API_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Extract all visible text from this image. Return ONLY the extracted text, no explanations or descriptions. If there is no text, return "No text found".',
                    },
                    {
                      type: 'image_url',
                      image_url: { url: dataUrl },
                    },
                  ],
                },
              ],
              max_tokens: 2048,
              temperature: 0.2,
            }),
          },
          REQUEST_TIMEOUT
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Image OCR] Model ${model} failed (${response.status}):`, errorText);
          continue;
        }

        const data = await response.json();
        extractedText = data.choices?.[0]?.message?.content?.trim() || '';
        if (extractedText) break;
      } catch (err: any) {
        console.error(`[Image OCR] Model ${model} error:`, err?.message || err);
        continue;
      }
    }

    console.log(`[Image OCR] Extracted ${extractedText.length} characters`);
    return extractedText === 'No text found' ? '' : extractedText;
  } catch (err: any) {
    console.error('[Image OCR] Error:', err?.message || err);
    return '';
  }
}

export interface VisualEvaluationResult {
  isDiagram: boolean;
  diagramType: string;
  title: string;
  caption: string;
  extractedText: string;
  mermaidCode: string;
  entities: string[];
}

/**
 * Multimodal Visual & Diagram Evaluator:
 * Analyzes diagrams, flowcharts, architectures, schematics, and images using NVIDIA Vision API.
 * Synthesizes structured knowledge:
 * - Diagram classification & semantic description
 * - Complete OCR text extraction
 * - Clean, executable Mermaid.js code for flowcharts/architectures
 * - Extracted domain entities for Knowledge Graph connection
 */
export async function evaluateVisualAndDiagram(
  buffer: Buffer,
  mimeType: string,
  filename?: string
): Promise<VisualEvaluationResult> {
  const fallbackTitle = filename ? filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') : 'Visual Document';
  const defaultResult: VisualEvaluationResult = {
    isDiagram: false,
    diagramType: 'visual',
    title: fallbackTitle,
    caption: `Visual extracted from ${filename || 'uploaded document'}.`,
    extractedText: '',
    mermaidCode: '',
    entities: [],
  };

  try {
    const apiKey = getNvidiaApiKey();
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const visionModels = [
      'meta/llama-3.2-11b-vision-instruct',
      'meta/llama-3.2-90b-vision-instruct',
    ];

    const promptText = `You are an elite system architect and visual analyst. Thoroughly evaluate this visual asset/diagram.
Tasks:
1. Determine if this image is a diagram, flowchart, system architecture, sequence diagram, ER diagram, mindmap, data chart, wireframe, or general graphic.
2. Extract all visible text, labels, node names, and arrows (OCR).
3. Generate a descriptive, professional Title (2 to 6 words) for this diagram.
4. Write a comprehensive Caption explaining what this diagram represents, its components, flow of data/events, and key takeaways.
5. If this is a diagram or flowchart, write CLEAN, VALID Mermaid.js code reproducing its structure and relations.
   - For architectures/flowcharts use "graph TD" or "flowchart TD"
   - For interactions use "sequenceDiagram"
   - For schemas use "erDiagram"
   - Ensure node IDs do not have invalid characters (use A["Label"])
   - If not a diagram, return empty string for mermaidCode.
6. Extract key entities or components named in the diagram.

Return ONLY a valid JSON object with NO surrounding markdown or commentary:
{
  "isDiagram": true,
  "diagramType": "architecture",
  "title": "Clean Diagram Title",
  "caption": "Detailed explanation of the visual and what it communicates...",
  "extractedText": "All text and labels found in the image",
  "mermaidCode": "graph TD\\n  A[Client] --> B[API Gateway]\\n  B --> C[Database]",
  "entities": ["Client", "API Gateway", "Database"]
}`;

    for (const model of visionModels) {
      try {
        const response = await fetchWithTimeout(
          NVIDIA_API_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: promptText },
                    { type: 'image_url', image_url: { url: dataUrl } },
                  ],
                },
              ],
              max_tokens: 3072,
              temperature: 0.1,
            }),
          },
          25_000
        );

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[Visual Eval] Model ${model} returned ${response.status}:`, errText);
          continue;
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content?.trim();
        if (!rawContent) continue;

        // Clean JSON markdown fences
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          // If not formatted as JSON, create a smart fallback with extracted text
          return {
            ...defaultResult,
            caption: rawContent.slice(0, 400),
            extractedText: rawContent,
          };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        let cleanMermaid = (parsed.mermaidCode || '').trim();
        // Remove markdown block if model accidentally wrapped it
        cleanMermaid = cleanMermaid.replace(/^```mermaid\s*/i, '').replace(/```$/i, '').trim();

        return {
          isDiagram: Boolean(parsed.isDiagram ?? (cleanMermaid.length > 0)),
          diagramType: typeof parsed.diagramType === 'string' ? parsed.diagramType : 'visual',
          title: (parsed.title && typeof parsed.title === 'string' && parsed.title.trim().length > 0)
            ? parsed.title.trim()
            : fallbackTitle,
          caption: typeof parsed.caption === 'string' ? parsed.caption.trim() : defaultResult.caption,
          extractedText: typeof parsed.extractedText === 'string' ? parsed.extractedText.trim() : '',
          mermaidCode: cleanMermaid,
          entities: Array.isArray(parsed.entities)
            ? parsed.entities.filter((e: any) => typeof e === 'string' && e.trim().length > 0)
            : [],
        };
      } catch (err: any) {
        console.warn(`[Visual Eval] Model ${model} evaluation error:`, err?.message || err);
        continue;
      }
    }

    return defaultResult;
  } catch (err: any) {
    console.error('[Visual Eval] Fatal error evaluating image:', err?.message || err);
    return defaultResult;
  }
}

