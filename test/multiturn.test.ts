import { describe, it, expect } from 'vitest';
import { OpenAIAdapter } from '@/providers/openai';
import { AnthropicAdapter } from '@/providers/anthropic';
import type { ChatMessage, InternalEvent, ProviderAdapter } from '@/providers/base';
import { PROXY_LEGACY as PROXY } from './helpers';

const TIMEOUT = 90000;

async function turn(
  adapter: ProviderAdapter,
  model: string,
  history: ChatMessage[],
  userText: string,
  maxTokens = 400,
): Promise<{ assistantText: string; events: InternalEvent[] }> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: userText }];
  const events: InternalEvent[] = [];
  let assistantText = '';
  for await (const ev of adapter.stream({ model, messages, max_tokens: maxTokens })) {
    events.push(ev);
    if (ev.type === 'text_delta') assistantText += ev.text;
  }
  return { assistantText, events };
}

interface MultiTurnResult {
  finalText: string;
  turns: Array<{ user: string; assistant: string }>;
  errors: string[];
}

async function runMultiTurn(
  adapter: ProviderAdapter,
  model: string,
  userTurns: string[],
): Promise<MultiTurnResult> {
  const history: ChatMessage[] = [];
  const turns: Array<{ user: string; assistant: string }> = [];
  const errors: string[] = [];
  for (const u of userTurns) {
    const { assistantText, events } = await turn(adapter, model, history, u);
    const err = events.find((e) => e.type === 'error');
    if (err && err.type === 'error') errors.push(err.message);
    history.push({ role: 'user', content: u });
    history.push({ role: 'assistant', content: assistantText });
    turns.push({ user: u, assistant: assistantText });
  }
  return {
    finalText: turns[turns.length - 1]?.assistant ?? '',
    turns,
    errors,
  };
}

const TURNS = [
  'Remember this secret code: ALPHA-7341. Just acknowledge briefly.',
  'Also remember this second secret code: BETA-9928. Just acknowledge briefly.',
  'Now reply with the two secret codes I asked you to remember, in the order I gave them, separated by a comma. Output ONLY the two codes, nothing else.',
];

function logTurns(label: string, result: MultiTurnResult): void {
  console.log(`\n=== ${label} ===`);
  result.turns.forEach((t, i) => {
    console.log(`[turn ${i + 1}] user: ${t.user}`);
    console.log(`[turn ${i + 1}] assistant: ${t.assistant}`);
  });
  if (result.errors.length) console.log('errors:', result.errors);
}

describe('Multi-turn context retention', () => {
  it(
    'GPT-5.4 remembers two codes across 3 turns',
    async () => {
      const adapter = new OpenAIAdapter(PROXY);
      const result = await runMultiTurn(adapter, 'gpt-5.4', TURNS);
      logTurns('GPT-5.4 multi-turn', result);
      expect(result.errors, JSON.stringify(result.errors)).toHaveLength(0);
      expect(result.finalText).toContain('ALPHA-7341');
      expect(result.finalText).toContain('BETA-9928');
    },
    TIMEOUT,
  );

  it(
    'Claude Sonnet 4.6 (OpenAI protocol) remembers two codes across 3 turns',
    async () => {
      const adapter = new OpenAIAdapter(PROXY);
      const result = await runMultiTurn(adapter, 'claude-sonnet-4-6', TURNS);
      logTurns('Claude (OpenAI proto) multi-turn', result);
      expect(result.errors, JSON.stringify(result.errors)).toHaveLength(0);
      expect(result.finalText).toContain('ALPHA-7341');
      expect(result.finalText).toContain('BETA-9928');
    },
    TIMEOUT,
  );

  it(
    'Claude Sonnet 4.6 (Anthropic native /v1/messages) remembers two codes across 3 turns',
    async () => {
      const adapter = new AnthropicAdapter(PROXY);
      const result = await runMultiTurn(adapter, 'claude-sonnet-4-6', TURNS);
      logTurns('Claude (Anthropic native) multi-turn', result);
      expect(result.errors, JSON.stringify(result.errors)).toHaveLength(0);
      expect(result.finalText).toContain('ALPHA-7341');
      expect(result.finalText).toContain('BETA-9928');
    },
    TIMEOUT,
  );
});
