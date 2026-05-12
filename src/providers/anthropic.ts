import { parseSSE } from './stream-parser';
import type {
  ChatMessage,
  ChatRequest,
  InternalEvent,
  ProviderAdapter,
  ProviderConfig,
} from './base';
import { THINKING_BUDGETS } from './base';

interface BlockMeta {
  type: string;
  id?: string;
  name?: string;
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly id: string;
  readonly protocol = 'anthropic' as const;

  constructor(private config: ProviderConfig) {
    this.id = config.id;
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<InternalEvent> {
    const url = `${this.config.baseURL.replace(/\/$/, '')}/v1/messages`;
    const { messages, system } = toAnthropicMessages(req.messages, req.system);

    // Claude Code style: system is an array of text blocks with cache_control on the last block.
    const systemBlocks =
      system && system.length > 0
        ? [
            {
              type: 'text',
              text: system,
              cache_control: { type: 'ephemeral' },
            },
          ]
        : undefined;

    // Claude Code style: tools array with cache_control on the last tool definition.
    const tools = req.tools?.length
      ? req.tools.map((t, i) => {
          const base: Record<string, unknown> = {
            name: t.name,
            description: t.description,
            input_schema: t.input_schema,
          };
          if (i === req.tools!.length - 1) base.cache_control = { type: 'ephemeral' };
          return base;
        })
      : undefined;

    // Cache the conversation history prefix on the second-to-last user/assistant turn
    // (Claude Code pattern: incremental caching across multi-turn).
    const cachedMessages = applyMessageCacheControl(messages);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: req.model,
          messages: cachedMessages,
          ...(systemBlocks ? { system: systemBlocks } : {}),
          ...(tools ? { tools } : {}),
          stream: true,
          max_tokens: req.max_tokens ?? 4096,
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.thinking && req.thinking !== 'off'
            ? {
                thinking: {
                  type: 'enabled',
                  budget_tokens: THINKING_BUDGETS[req.thinking],
                },
              }
            : {}),
        }),
        signal,
      });
    } catch (e) {
      yield { type: 'error', message: (e as Error).message };
      yield { type: 'done', stop_reason: 'unknown' };
      return;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      yield { type: 'error', message: `HTTP ${response.status}: ${text.slice(0, 500)}`, status: response.status };
      yield { type: 'done', stop_reason: 'unknown' };
      return;
    }

    const blockMeta: Record<number, BlockMeta> = {};
    const toolJsonBuf: Record<number, string> = {};
    let stopReason: string | null = null;

    try {
      for await (const { event, data } of parseSSE(response)) {
        if (data === '[DONE]') break;
        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(data);
        } catch {
          continue;
        }

        if (event === 'content_block_start') {
          const idx = obj.index as number;
          const cb = obj.content_block as Record<string, unknown>;
          blockMeta[idx] = { type: cb.type as string, id: cb.id as string | undefined, name: cb.name as string | undefined };
          if (cb.type === 'tool_use' && cb.id && cb.name) {
            toolJsonBuf[idx] = '';
            yield { type: 'tool_use_start', id: cb.id as string, name: cb.name as string };
          }
        } else if (event === 'content_block_delta') {
          const idx = obj.index as number;
          const d = obj.delta as Record<string, unknown>;
          if (d.type === 'text_delta') {
            yield { type: 'text_delta', text: d.text as string };
          } else if (d.type === 'thinking_delta') {
            yield { type: 'thinking_delta', text: (d.thinking as string) || '' };
          } else if (d.type === 'input_json_delta') {
            const partial = (d.partial_json as string) || '';
            toolJsonBuf[idx] = (toolJsonBuf[idx] || '') + partial;
            const meta = blockMeta[idx];
            if (meta?.id && partial) {
              yield { type: 'tool_use_delta', id: meta.id, partial_json: partial };
            }
          } else if (d.type === 'citations_delta') {
            const c = d.citation as Record<string, unknown>;
            yield {
              type: 'citation',
              index: idx,
              url: (c.url as string) || '',
              title: c.title as string | undefined,
              quote: c.cited_text as string | undefined,
            };
          }
        } else if (event === 'content_block_stop') {
          const idx = obj.index as number;
          const meta = blockMeta[idx];
          if (meta?.type === 'tool_use' && meta.id && meta.name) {
            const raw = toolJsonBuf[idx] || '{}';
            let parsed: Record<string, unknown> = {};
            try {
              parsed = JSON.parse(raw);
            } catch {
              /* leave empty */
            }
            yield { type: 'tool_use_stop', id: meta.id, name: meta.name, input: parsed };
          }
        } else if (event === 'message_delta') {
          const delta = obj.delta as Record<string, unknown> | undefined;
          if (delta && typeof delta.stop_reason === 'string') stopReason = delta.stop_reason;
          const usage = obj.usage as Record<string, number> | undefined;
          if (usage) {
            yield {
              type: 'usage',
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              cached_tokens: usage.cache_read_input_tokens,
            };
          }
        } else if (event === 'message_start') {
          const msg = obj.message as Record<string, unknown> | undefined;
          const usage = msg?.usage as Record<string, number> | undefined;
          if (usage) {
            yield {
              type: 'usage',
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              cached_tokens: usage.cache_read_input_tokens,
            };
          }
        }
      }
    } catch (e) {
      yield { type: 'error', message: (e as Error).message };
    }

    yield {
      type: 'done',
      stop_reason:
        stopReason === 'tool_use'
          ? 'tool_use'
          : stopReason === 'end_turn'
            ? 'end_turn'
            : stopReason === 'max_tokens'
              ? 'max_tokens'
              : stopReason === 'stop_sequence'
                ? 'stop'
                : 'unknown',
    };
  }
}

function toAnthropicMessages(
  msgs: ChatMessage[],
  systemTop?: string,
): { messages: Array<Record<string, unknown>>; system?: string } {
  const out: Array<Record<string, unknown>> = [];
  let system = systemTop;

  for (const m of msgs) {
    if (m.role === 'system') {
      const text = typeof m.content === 'string' ? m.content : '';
      system = system ? `${system}\n\n${text}` : text;
      continue;
    }

    if (m.role === 'tool') {
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.tool_call_id,
            content: typeof m.content === 'string' ? m.content : '',
          },
        ],
      });
      continue;
    }

    if (m.role === 'assistant') {
      if (Array.isArray(m.content)) {
        const blocks: Array<Record<string, unknown>> = [];
        for (const b of m.content) {
          if (b.type === 'text') blocks.push({ type: 'text', text: b.text });
          else if (b.type === 'tool_use')
            blocks.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input });
        }
        out.push({ role: 'assistant', content: blocks });
      } else if (m.tool_calls?.length) {
        const blocks: Array<Record<string, unknown>> = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments);
          } catch {
            /* leave empty */
          }
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
        out.push({ role: 'assistant', content: blocks });
      } else {
        out.push({ role: 'assistant', content: m.content });
      }
      continue;
    }

    if (m.role === 'user') {
      if (Array.isArray(m.content)) {
        const blocks: Array<Record<string, unknown>> = [];
        for (const b of m.content) {
          if (b.type === 'text') blocks.push({ type: 'text', text: b.text });
          else if (b.type === 'image_url') {
            const url = b.image_url.url;
            const m2 = url.match(/^data:(.+?);base64,(.+)$/);
            if (m2) {
              blocks.push({
                type: 'image',
                source: { type: 'base64', media_type: m2[1], data: m2[2] },
              });
            } else {
              blocks.push({ type: 'image', source: { type: 'url', url } });
            }
          } else if (b.type === 'tool_result') {
            blocks.push({
              type: 'tool_result',
              tool_use_id: b.tool_use_id,
              content: b.content,
              ...(b.is_error ? { is_error: true } : {}),
            });
          }
        }
        out.push({ role: 'user', content: blocks });
      } else {
        out.push({ role: 'user', content: m.content });
      }
    }
  }

  return { messages: out, system };
}

// Apply cache_control: ephemeral to the last content block of the
// last user message (or the message just before the latest user input),
// to cache the prefix shared across multi-turn requests.
// Strategy: tag the very last message's last content block.
function applyMessageCacheControl(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  if (messages.length === 0) return messages;
  const out = messages.map((m) => ({ ...m }));
  const last = out[out.length - 1];
  const content = last.content;
  if (typeof content === 'string') {
    last.content = [{ type: 'text', text: content, cache_control: { type: 'ephemeral' } }];
  } else if (Array.isArray(content) && content.length > 0) {
    const blocks = content.map((b) => ({ ...(b as Record<string, unknown>) }));
    blocks[blocks.length - 1] = {
      ...blocks[blocks.length - 1],
      cache_control: { type: 'ephemeral' },
    };
    last.content = blocks;
  }
  return out;
}
