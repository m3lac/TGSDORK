import { loadConfig } from '../core/config.js';
import type { GenerateTextOptions, AppConfig } from '../types/index.js';

let geminiKeyIndex = 0;
let openaiKeyIndex = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getActiveKey(keys: string[], currentIndex: number): string {
  if (keys.length === 0) return '';
  return keys[currentIndex % keys.length];
}

interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
}

// ponytail: custom W3C-compliant SSE parser for reliable chunk reassembly and error bubbling
export class CustomSSEParser {
  private buffer = '';

  public feed(chunk: string): SSEEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const events: SSEEvent[] = [];

    let boundaryIdx: number;
    while ((boundaryIdx = this.buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = this.buffer.slice(0, boundaryIdx);
      this.buffer = this.buffer.slice(boundaryIdx + 2);
      const parsed = this.parseRawEvent(rawEvent);
      if (parsed) events.push(parsed);
    }

    return events;
  }

  public flush(): SSEEvent[] {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return [];
    }
    const parsed = this.parseRawEvent(this.buffer);
    this.buffer = '';
    return parsed ? [parsed] : [];
  }

  private parseRawEvent(raw: string): SSEEvent | null {
    const lines = raw.split('\n');
    let eventName: string | undefined;
    let eventId: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('id:')) {
        eventId = line.slice(3).trim();
      }
    }

    if (dataLines.length === 0 && !eventName) return null;
    return { event: eventName, id: eventId, data: dataLines.join('\n') };
  }
}

function extractTextFromRaw(raw: string): string {
  try {
    const data = JSON.parse(raw);
    const choice = data.choices?.[0];
    return (
      choice?.message?.content ||
      choice?.message?.reasoning_content ||
      choice?.text ||
      ''
    );
  } catch {
    return '';
  }
}

async function parseChatResponse(
  res: Response,
  onChunk?: (chunk: string) => void,
  onReasoning?: (chunk: string) => void
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return extractTextFromRaw(text);
  }

  const decoder = new TextDecoder('utf-8');
  const parser = new CustomSSEParser();
  let contentAcc = '';
  let reasoningAcc = '';
  let isSSE = false;
  let rawAll = '';

  const processEvent = (ev: SSEEvent) => {
    const dataStr = ev.data.trim();
    if (!dataStr) return;
    isSSE = true;
    if (dataStr === '[DONE]') return;

    try {
      const json = JSON.parse(dataStr);
      if (json.error) {
        const errMsg = json.error.message || JSON.stringify(json.error);
        const err = new Error(`OpenAI stream error: ${errMsg}`);
        if (json.error.code === 429 || /rate limit/i.test(errMsg)) {
          (err as unknown as { status: number }).status = 429;
        }
        throw err;
      }
      const choice = json.choices?.[0];
      const delta = choice?.delta;
      if (delta?.content) {
        contentAcc += delta.content;
        if (onChunk) onChunk(delta.content);
      }
      if (delta?.reasoning_content) {
        reasoningAcc += delta.reasoning_content;
        if (onReasoning) onReasoning(delta.reasoning_content);
      }
      if (!delta && choice?.text) {
        contentAcc += choice.text;
        if (onChunk) onChunk(choice.text);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('OpenAI stream error:')) {
        throw err;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    rawAll += chunk;

    const events = parser.feed(chunk);
    for (const ev of events) {
      processEvent(ev);
    }
  }

  const remaining = decoder.decode();
  if (remaining) {
    rawAll += remaining;
    for (const ev of parser.feed(remaining)) {
      processEvent(ev);
    }
  }
  for (const ev of parser.flush()) {
    processEvent(ev);
  }

  if (isSSE && (contentAcc || reasoningAcc)) {
    return contentAcc || reasoningAcc;
  }

  return extractTextFromRaw(rawAll);
}

export function sanitizeAcademicText(raw: string): string {
  let out = raw.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
  return out
    .replace(/```([a-zA-Z0-9_-]*)[ \t]*\n([\s\S]*?)```/g, (full, lang: string, content: string) => {
      const l = (lang || '').toLowerCase();
      if (l === 'mermaid') return full;
      if (l === 'markdown' || l === 'md' || !l) return content;
      return '';
    })
    .replace(/^.*(?:(?:→|->)\s*skipped:|\bponytail:).*$/gim, '')
    .replace(/^[ \t]*(?:[-*]\s*)?(?:\*\*|\*|`)?(?:skipped|add when|risk|risks)\s*:.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function callOpenAI(
  config: AppConfig,
  opts: GenerateTextOptions,
  apiKey: string
): Promise<string> {
  const model = opts.model
    ?? (opts.role === 'writer'
      ? config.openai.models.writer
      : config.openai.models.fast);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (opts.systemPrompt) {
    messages.push({ role: 'system', content: opts.systemPrompt });
  }
  messages.push({ role: 'user', content: opts.prompt });

  const url = `${config.openai.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.4,
    max_tokens: opts.role === 'writer' ? 8192 : 3500,
    // ponytail: stream=true prevents Cloudflare 524 timeouts on long reasoning/writing tasks
    stream: true,
  };

  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    const err = new Error(`OpenAI API error [${res.status}]: ${errorText}`);
    (err as unknown as { status: number }).status = res.status;
    throw err;
  }

  let text = await parseChatResponse(res, opts.onChunk, opts.onReasoning);
  if (opts.jsonMode) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    // extract JSON object if wrapped in prose
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
  } else {
    text = sanitizeAcademicText(text);
  }

  if (!text) {
    throw new Error('OpenAI returned empty message content');
  }

  return text;
}

async function callGemini(
  config: AppConfig,
  opts: GenerateTextOptions,
  apiKey: string
): Promise<string> {
  const model = opts.model
    ?? (opts.role === 'writer'
      ? config.gemini.models.writer
      : config.gemini.models.fast);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${apiKey}`;

  const contents: Array<{
    role?: string;
    parts: Array<{ text: string }>;
  }> = [];

  const userParts: Array<{ text: string }> = [];
  if (opts.systemPrompt) {
    userParts.push({ text: `[SYSTEM INSTRUCTION]\n${opts.systemPrompt}\n\n` });
  }
  userParts.push({ text: opts.prompt });

  contents.push({
    role: 'user',
    parts: userParts,
  });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.3,
    },
  };

  if (opts.jsonMode) {
    (body.generationConfig as Record<string, unknown>).responseMimeType =
      'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    const err = new Error(`Gemini API error [${res.status}]: ${errorText}`);
    (err as unknown as { status: number }).status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned empty candidate text');
  }

  if (opts.jsonMode) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
  }

  return text;
}

export async function generateText(
  opts: GenerateTextOptions
): Promise<string> {
  const config = loadConfig();
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const isGemini = config.provider === 'gemini';
    const keys = isGemini ? config.gemini.apiKeys : config.openai.apiKeys;
    const currentIdx = isGemini ? geminiKeyIndex : openaiKeyIndex;
    const apiKey = getActiveKey(keys, currentIdx);

    if (!apiKey) {
      throw new Error(
        `No API key configured for provider "${config.provider}". Set key via CLI or environment variable.`
      );
    }

    try {
      if (isGemini) {
        return await callGemini(config, opts, apiKey);
      } else {
        return await callOpenAI(config, opts, apiKey);
      }
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isRateLimitOrServer =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        status === 520 ||
        status === 521 ||
        status === 524 ||
        /disconnected|unavailable|socket|timeout|fetch failed|network|terminated|econnreset|enotfound|und_err|empty message/i.test(errMsg);

      if (isRateLimitOrServer && attempt < maxRetries) {
        // Rotate key
        if (isGemini) {
          geminiKeyIndex = (geminiKeyIndex + 1) % Math.max(1, keys.length);
        } else {
          openaiKeyIndex = (openaiKeyIndex + 1) % Math.max(1, keys.length);
        }

        const backoffMs = 2500 * Math.pow(1.5, attempt);
        // ponytail: wait and rotate key on 429/500/502/503/504 network glitches
        await sleep(backoffMs);
        continue;
      }

      throw err;
    }
  }

  throw new Error('Failed to generate text after max retries');
}
