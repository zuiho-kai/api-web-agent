import { describe, it, expect } from 'vitest';
import { AnthropicAdapter } from '@/providers/anthropic';
import type { ChatRequest, InternalEvent } from '@/providers/base';
import { PROXY_CACHEABLE as PROXY_NEW_KEY } from './helpers';

const TIMEOUT = 60000;

// Long enough system prompt to exceed Anthropic's minimum cacheable size (1024 tokens for Sonnet).
const LONG_SYSTEM_PROMPT = Array.from({ length: 30 })
  .map(
    (_, i) =>
      `Section ${i + 1}: You are a meticulous assistant operating under strict constraints. ` +
      `When responding to user queries, you must adhere to the following operational guideline ${i + 1}: ` +
      `always cite sources, never speculate beyond provided context, prefer concise structured output, ` +
      `acknowledge uncertainty when present, avoid filler language, and respect user privacy at all costs. ` +
      `Additional clarification for guideline ${i + 1}: prefer plain text over markdown unless explicitly requested, ` +
      `use ISO-8601 for all dates, use SI units for measurements, and reply in the language of the user's last message.`,
  )
  .join('\n\n');

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
}

async function callAndCollectUsage(req: ChatRequest, adapter: AnthropicAdapter): Promise<Usage> {
  const usages: Usage[] = [];
  const events: InternalEvent[] = [];
  for await (const ev of adapter.stream(req)) {
    events.push(ev);
    if (ev.type === 'usage') {
      usages.push({
        input_tokens: ev.input_tokens,
        output_tokens: ev.output_tokens,
        cached_tokens: ev.cached_tokens,
      });
    }
  }
  // Merge all usage events (some adapters emit usage on message_start and message_delta).
  return usages.reduce<Usage>(
    (acc, u) => ({
      input_tokens: acc.input_tokens ?? u.input_tokens,
      output_tokens: u.output_tokens ?? acc.output_tokens,
      cached_tokens: Math.max(acc.cached_tokens ?? 0, u.cached_tokens ?? 0) || u.cached_tokens,
    }),
    {},
  );
}

describe('Prompt caching via AnthropicAdapter (cacheable key)', () => {
  it(
    'second identical request hits the cache',
    async () => {
      const adapter = new AnthropicAdapter(PROXY_NEW_KEY);
      const req: ChatRequest = {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        system: LONG_SYSTEM_PROMPT,
        max_tokens: 20,
        temperature: 0,
      };

      const u1 = await callAndCollectUsage(req, adapter);
      console.log('\n=== Request 1 (cache creation) ===');
      console.log(JSON.stringify(u1, null, 2));

      // Wait briefly to ensure the cache is established.
      await new Promise((r) => setTimeout(r, 1500));

      const u2 = await callAndCollectUsage(req, adapter);
      console.log('=== Request 2 (cache hit expected) ===');
      console.log(JSON.stringify(u2, null, 2));

      expect(u2.cached_tokens, 'second request should read from cache').toBeGreaterThan(0);
      // Cache hit should cover most of the system prompt tokens (>500).
      expect((u2.cached_tokens ?? 0)).toBeGreaterThan(500);
    },
    TIMEOUT,
  );
});
