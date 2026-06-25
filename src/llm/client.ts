import OpenAI from 'openai';
import { config } from '../config';

// ── Groq client (OpenAI-compatible) ──────────────────────────────────────────
const groq = config.llm.groqApiKey
  ? new OpenAI({ apiKey: config.llm.groqApiKey, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

// ── OpenRouter client ─────────────────────────────────────────────────────────
const openrouter = config.llm.openrouterApiKey
  ? new OpenAI({
      apiKey: config.llm.openrouterApiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'personal-growth-agent', 'X-Title': 'Mill Growth Agent' },
    })
  : null;

// ── Gemini via OpenAI-compat endpoint ─────────────────────────────────────────
const gemini = config.llm.geminiApiKey
  ? new OpenAI({
      apiKey: config.llm.geminiApiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  : null;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function tryClient(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
  label: string
): Promise<string> {
  const res = await client.chat.completions.create({ model, messages, max_tokens: 800 });
  if (res.usage) {
    console.log(`[${label}] Used ${res.usage.total_tokens} tokens (Prompt: ${res.usage.prompt_tokens}, Completion: ${res.usage.completion_tokens})`);
  }
  const text = res.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error(`${label} returned empty response`);
  return text;
}

/**
 * Fallback chain: Groq → OpenRouter → Gemini
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const errors: string[] = [];

  if (groq) {
    try {
      return await tryClient(groq, 'llama-3.3-70b-versatile', messages, 'Groq');
    } catch (e) {
      errors.push(`Groq: ${(e as Error).message}`);
    }
  }

  if (openrouter) {
    try {
      return await tryClient(openrouter, 'openrouter/free', messages, 'OpenRouter');
    } catch (e) {
      errors.push(`OpenRouter: ${(e as Error).message}`);
    }
  }

  if (gemini) {
    try {
      return await tryClient(gemini, 'gemini-1.5-flash', messages, 'Gemini');
    } catch (e) {
      errors.push(`Gemini: ${(e as Error).message}`);
    }
  }

  throw new Error(`All LLM providers failed:\n${errors.join('\n')}`);
}
