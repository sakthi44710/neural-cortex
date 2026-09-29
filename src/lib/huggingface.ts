/**
 * HuggingFace Inference API Integration
 * 
 * Free-tier models used:
 * - mistralai/Mistral-7B-Instruct-v0.3  (chat/reasoning - cross-validation)
 * - HuggingFaceH4/zephyr-7b-beta         (chat fallback)
 * - facebook/bart-large-cnn              (summarization - cross-validation)
 * - openai/whisper-large-v3              (audio/video transcription)
 */

const HF_API_URL = 'https://router.huggingface.co/hf-inference';

function getHfApiKey(): string {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) {
    throw new Error('HUGGINGFACE_API_KEY is not configured');
  }
  return key;
}

const HF_CHAT_MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.3',
  'HuggingFaceH4/zephyr-7b-beta',
];

const HF_SUMMARIZATION_MODEL = 'facebook/bart-large-cnn';
const HF_WHISPER_MODEL = 'openai/whisper-large-v3';

const HF_TIMEOUT = 8_000; // 8s — fast fail so user chat is never blocked

// ─── Helpers ───────────────────────────────────────────────

async function hfFetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 1,
  timeoutMs = HF_TIMEOUT
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      // HF returns 503 while model is loading — wait and retry
      if (res.status === 503 && attempt < retries) {
        const body = await res.json().catch(() => ({}));
        const wait = Math.min((body.estimated_time || 15) * 1000, 30_000);
        console.log(`[HF] Model loading, waiting ${(wait / 1000).toFixed(0)}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retries) {
        console.log(`[HF] Attempt ${attempt + 1} failed: ${err.message}, retrying...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('HF API: max retries exceeded');
}

// ─── Chat Completion ───────────────────────────────────────

interface HFChatOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export async function hfChat(options: HFChatOptions): Promise<string> {
  const { messages, maxTokens = 1024, temperature = 0.7, model } = options;
  const apiKey = getHfApiKey();

  const modelsToTry = model ? [model] : HF_CHAT_MODELS;
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    try {
      const res = await hfFetchWithRetry(
        `${HF_API_URL}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: false,
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[HF] Chat error (${currentModel}): ${res.status}`, errText);
        lastError = new Error(`HF API ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
      lastError = new Error('Empty HF response');
      continue;
    } catch (err: any) {
      console.error(`[HF] Model ${currentModel} failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('All HF chat models failed');
}

// ─── Summarization (BART) ──────────────────────────────────

export async function hfSummarize(text: string): Promise<string> {
  const apiKey = getHfApiKey();

  const truncated = text.slice(0, 3000); // BART has a 1024-token limit, ~3k chars safe

  try {
    const res = await hfFetchWithRetry(
      `${HF_API_URL}/models/${HF_SUMMARIZATION_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: truncated,
          parameters: {
            max_length: 200,
            min_length: 30,
            do_sample: false,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[HF] Summarization error:', res.status, errText);
      return '';
    }

    const data = await res.json();
    return data?.[0]?.summary_text || '';
  } catch (err: any) {
    console.error('[HF] Summarization failed:', err.message);
    return '';
  }
}

// ─── Audio/Video Transcription (Whisper) ───────────────────

export async function hfTranscribeAudio(
  buffer: Buffer,
  mimeType: string = 'audio/mpeg'
): Promise<string> {
  const apiKey = getHfApiKey();

  console.log(`[HF Whisper] Transcribing ${(buffer.length / 1024 / 1024).toFixed(1)} MB of ${mimeType}...`);

  try {
    const res = await hfFetchWithRetry(
      `${HF_API_URL}/models/${HF_WHISPER_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': mimeType,
        },
        body: new Uint8Array(buffer),
      },
      3, // more retries for transcription (model often cold)
      120_000 // 2 min timeout — large files take time
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[HF Whisper] Error:', res.status, errText);
      return '';
    }

    const data = await res.json();
    const transcript = data?.text || '';
    console.log(`[HF Whisper] ✅ Transcribed ${transcript.length} chars`);
    return transcript;
  } catch (err: any) {
    console.error('[HF Whisper] Transcription failed:', err.message);
    return '';
  }
}

// ─── Check if HuggingFace is configured ────────────────────

export function isHuggingFaceConfigured(): boolean {
  return !!process.env.HUGGINGFACE_API_KEY;
}
