import { describe, it, expect } from 'vitest';
import { OpenAIAdapter } from '@/providers/openai';
import { AnthropicAdapter } from '@/providers/anthropic';
import { buildAdapter, detectProtocol } from '@/providers/router';
import { runAgent, type AgentEvent } from '@/agent/loop';
import { createDefaultRegistry } from '@/tools/builtin';
import { parseSSE } from '@/providers/stream-parser';
import type { InternalEvent } from '@/providers/base';
import { PROXY_LEGACY as PROXY } from './helpers';

const TIMEOUT = 60000;

async function collect(stream: AsyncGenerator<InternalEvent>): Promise<InternalEvent[]> {
  const events: InternalEvent[] = [];
  for await (const ev of stream) events.push(ev);
  return events;
}

async function collectAgent(stream: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const ev of stream) events.push(ev);
  return events;
}

describe('Router', () => {
  it('claude-* routes to anthropic', () => {
    expect(detectProtocol('claude-sonnet-4-6')).toBe('anthropic');
    expect(detectProtocol('claude-opus-4-7')).toBe('anthropic');
  });

  it('non-claude routes to openai', () => {
    expect(detectProtocol('gpt-5.4')).toBe('openai');
    expect(detectProtocol('grok-4')).toBe('openai');
    expect(detectProtocol('deepseek-chat')).toBe('openai');
  });

  it('explicit protocol overrides auto-detect', () => {
    expect(detectProtocol('claude-haiku-4-5', 'openai')).toBe('openai');
    expect(detectProtocol('gpt-5.4', 'anthropic')).toBe('anthropic');
  });

  it('buildAdapter picks correct class', () => {
    expect(buildAdapter(PROXY, 'claude-sonnet-4-6')).toBeInstanceOf(AnthropicAdapter);
    expect(buildAdapter(PROXY, 'gpt-5.4')).toBeInstanceOf(OpenAIAdapter);
  });
});

describe('SSE parser', () => {
  it('parses Anthropic-style event+data', async () => {
    const body = 'event: message_start\ndata: {"hi":1}\n\nevent: message_stop\ndata: {"hi":2}\n\n';
    const res = new Response(body);
    const events: Array<{ event: string | null; data: string }> = [];
    for await (const ev of parseSSE(res)) events.push(ev);
    expect(events).toEqual([
      { event: 'message_start', data: '{"hi":1}' },
      { event: 'message_stop', data: '{"hi":2}' },
    ]);
  });

  it('parses OpenAI-style data-only', async () => {
    const body = 'data: {"a":1}\n\ndata: {"a":2}\n\ndata: [DONE]\n\n';
    const res = new Response(body);
    const events: Array<{ event: string | null; data: string }> = [];
    for await (const ev of parseSSE(res)) events.push(ev);
    expect(events).toEqual([
      { event: null, data: '{"a":1}' },
      { event: null, data: '{"a":2}' },
      { event: null, data: '[DONE]' },
    ]);
  });
});

describe('OpenAIAdapter (real proxy)', () => {
  it(
    'streams gpt-5.4 plain text',
    async () => {
      const adapter = new OpenAIAdapter(PROXY);
      const events = await collect(
        adapter.stream({
          model: 'gpt-5.4',
          messages: [{ role: 'user', content: 'Reply with exactly: PONG' }],
          max_tokens: 20,
        }),
      );
      const text = events
        .filter((e): e is Extract<InternalEvent, { type: 'text_delta' }> => e.type === 'text_delta')
        .map((e) => e.text)
        .join('');
      const done = events.find((e) => e.type === 'done');
      expect(events.length).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);
      expect(done?.type).toBe('done');
    },
    TIMEOUT,
  );

  it(
    'streams claude-sonnet-4-6 via OpenAI protocol with tool calling',
    async () => {
      const adapter = new OpenAIAdapter(PROXY);
      const events = await collect(
        adapter.stream({
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'Use get_weather to look up weather in Beijing.' }],
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather for a city',
              input_schema: {
                type: 'object',
                properties: { city: { type: 'string' } },
                required: ['city'],
              },
            },
          ],
          max_tokens: 300,
        }),
      );
      const toolStop = events.find(
        (e): e is Extract<InternalEvent, { type: 'tool_use_stop' }> => e.type === 'tool_use_stop',
      );
      const done = events.find(
        (e): e is Extract<InternalEvent, { type: 'done' }> => e.type === 'done',
      );
      expect(toolStop, JSON.stringify(events, null, 2)).toBeDefined();
      expect(toolStop?.name).toBe('get_weather');
      expect(typeof toolStop?.input?.city).toBe('string');
      expect(done?.stop_reason).toBe('tool_use');
    },
    TIMEOUT,
  );
});

describe('AnthropicAdapter (real proxy)', () => {
  it(
    'streams claude via native /v1/messages with tool calling',
    async () => {
      const adapter = new AnthropicAdapter(PROXY);
      const events = await collect(
        adapter.stream({
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'Use get_weather to look up weather in Beijing.' }],
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather for a city',
              input_schema: {
                type: 'object',
                properties: { city: { type: 'string' } },
                required: ['city'],
              },
            },
          ],
          max_tokens: 300,
        }),
      );
      const toolStop = events.find(
        (e): e is Extract<InternalEvent, { type: 'tool_use_stop' }> => e.type === 'tool_use_stop',
      );
      const done = events.find(
        (e): e is Extract<InternalEvent, { type: 'done' }> => e.type === 'done',
      );
      expect(toolStop, JSON.stringify(events, null, 2)).toBeDefined();
      expect(toolStop?.name).toBe('get_weather');
      expect(typeof toolStop?.input?.city).toBe('string');
      expect(done?.stop_reason).toBe('tool_use');
    },
    TIMEOUT,
  );
});

describe('Web search tool (real Jina)', () => {
  it(
    'fetches actual search results from Jina+DDG',
    async () => {
      const registry = createDefaultRegistry();
      const tool = registry.get('web_search');
      expect(tool).toBeDefined();
      const result = await tool!.execute(
        { query: 'today weather tokyo' },
        { signal: undefined },
      );
      expect(result.length).toBeGreaterThan(0);
      const text = result.find((r) => r.type === 'text');
      expect(text, JSON.stringify(result)).toBeDefined();
      if (text?.type === 'text') {
        const lower = text.text.toLowerCase();
        expect(lower).toMatch(/tokyo|weather|temperature/);
      }
    },
    TIMEOUT,
  );
});

describe('Agent loop end-to-end (Tokyo weather)', () => {
  it(
    'GPT-5.4 calls web_search and produces text grounded in results',
    async () => {
      const adapter = new OpenAIAdapter(PROXY);
      const registry = createDefaultRegistry();
      const events = await collectAgent(
        runAgent({
          adapter,
          registry,
          request: {
            model: 'gpt-5.4',
            messages: [{ role: 'user', content: "What's the weather in Tokyo today? Search the web and tell me the temperature." }],
            system: 'You are a helpful assistant. Use web_search when fresh data is needed.',
            max_tokens: 800,
          },
          maxIterations: 4,
        }),
      );

      const toolExecs = events.filter((e) => e.type === 'tool_exec_done');
      const lastDone = [...events].reverse().find((e) => e.type === 'done');
      const finalText = events
        .filter((e): e is Extract<AgentEvent, { type: 'text_delta' }> => e.type === 'text_delta')
        .map((e) => e.text)
        .join('');

      console.log('=== GPT-5.4 final text ===');
      console.log(finalText);
      console.log('=== tool execs ===');
      console.log(JSON.stringify(toolExecs.map(t => ({ name: (t as any).name, content_len: (t as any).content?.length })), null, 2));

      expect(toolExecs.length, 'should have executed at least one tool').toBeGreaterThanOrEqual(1);
      expect(lastDone?.type).toBe('done');
      expect(finalText.length).toBeGreaterThan(20);
      expect(finalText.toLowerCase()).toMatch(/tokyo|tōkyō|東京/);
    },
    TIMEOUT * 2,
  );

  it(
    'claude-sonnet-4-6 (OpenAI protocol) calls web_search end-to-end',
    async () => {
      const adapter = new OpenAIAdapter(PROXY);
      const registry = createDefaultRegistry();
      const events = await collectAgent(
        runAgent({
          adapter,
          registry,
          request: {
            model: 'claude-sonnet-4-6',
            messages: [{ role: 'user', content: "Search the web for today's weather in Tokyo. Reply with the temperature." }],
            max_tokens: 800,
          },
          maxIterations: 4,
        }),
      );

      const toolExecs = events.filter((e) => e.type === 'tool_exec_done');
      const finalText = events
        .filter((e): e is Extract<AgentEvent, { type: 'text_delta' }> => e.type === 'text_delta')
        .map((e) => e.text)
        .join('');

      console.log('=== Claude (OpenAI protocol) final text ===');
      console.log(finalText);
      console.log('=== tool execs ===');
      console.log(JSON.stringify(toolExecs.map(t => ({ name: (t as any).name })), null, 2));

      expect(toolExecs.length).toBeGreaterThanOrEqual(1);
      expect(finalText.length).toBeGreaterThan(10);
    },
    TIMEOUT * 2,
  );
});
