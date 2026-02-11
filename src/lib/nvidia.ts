const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

// Primary model (fast, reliable) with fallbacks
const MODELS = [
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-70b-instruct',
  'mistralai/mistral-large-2-instruct',
];

const REQUEST_TIMEOUT = 45_000; // 45 seconds

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
    temperature = 0.7,
    model,
  } = options;

  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY is not configured');
  }

  const modelsToTry = model ? [model, ...MODELS] : MODELS;
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    try {
      const response = await fetchWithTimeout(
        NVIDIA_API_URL,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
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

// Streaming chat — returns a ReadableStream of SSE chunks
export async function nvidiaChatStream(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
  const {
    messages,
    maxTokens = 4096,
    temperature = 0.7,
    model,
  } = options;

  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY is not configured');
  }

  const currentModel = model || MODELS[0];

  const response = await fetchWithTimeout(
    NVIDIA_API_URL,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA API stream error ${response.status}: ${error}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

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
        .filter((e: any) => e && e.name && typeof e.name === 'string')
        .map((e: any) => ({
          name: e.name,
          type: ['concept', 'entity', 'idea'].includes(e.type) ? e.type : 'entity',
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
    if (!NVIDIA_API_KEY) {
      throw new Error('NVIDIA_API_KEY is not configured');
    }

    // Convert buffer to base64
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await fetchWithTimeout(
      NVIDIA_API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.2-90b-vision-instruct',
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
      throw new Error(`NVIDIA API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content?.trim() || '';

    console.log(`[Image OCR] Extracted ${extractedText.length} characters`);
    return extractedText === 'No text found' ? '' : extractedText;
  } catch (err: any) {
    console.error('[Image OCR] Error:', err?.message || err);
    return '';
  }
}
