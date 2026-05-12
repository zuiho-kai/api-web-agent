import { parseSSE } from './stream-parser';
import type {
  AssistantToolCall,
  ChatMessage,
  ChatRequest,
  InternalEvent,
  ProviderAdapter,
  ProviderConfig,
} from './base';
import { THINKING_EFFORT } from './base';

interface ToolCallAccum {
  id: string;
  name: string;
  arguments: string;
  emittedStart: boolean;
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly id: string;
  readonly protocol = 'openai' as const;

  constructor(private config: ProviderConfig) {
    this.id = config.id;
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<InternalEvent> {
    const url = `${this.config.baseURL.replace(/\/$/, '')}/v1/chat/completions`;
    const messages = toOpenAIMessages(req.messages, req.system);
    const tools = req.tools?.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages,
          ...(tools && tools.length ? { tools } : {}),
          stream: true,
          ...(req.max_tokens ? { max_tokens: req.max_tokens } : {}),
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.thinking && req.thinking !== 'off'
            ? { reasoning_effort: THINKING_EFFORT[req.thinking] }
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

    const toolCalls: ToolCallAccum[] = [];
    let finishReason: string | null = null;

    try {
      for await (const { data } of parseSSE(response)) {
        if (data === '[DONE]') break;
        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(data);
        } catch {
          continue;
        }

        const choices = obj.choices as Array<Record<string, unknown>> | undefined;
        const choice = choices?.[0];

        if (!choice) {
          const usage = obj.usage as Record<string, unknown> | undefined;
          if (usage) {
            yield {
              type: 'usage',
              input_tokens: usage.prompt_tokens as number | undefined,
              output_tokens: usage.completion_tokens as number | undefined,
              cached_tokens: (usage.prompt_tokens_details as Record<string, number> | undefined)?.cached_tokens,
            };
          }
          continue;
        }

        const delta = (choice.delta as Record<string, unknown>) || {};
        if (typeof delta.content === 'string' && delta.content) {
          yield { type: 'text_delta', text: delta.content };
        }

        const deltaToolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(deltaToolCalls)) {
          for (const tc of deltaToolCalls) {
            const idx = tc.index as number;
            if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', arguments: '', emittedStart: false };
            const item = toolCalls[idx];
            if (typeof tc.id === 'string' && tc.id) item.id = tc.id;
            const fn = tc.function as Record<string, unknown> | undefined;
            if (fn?.name) item.name = fn.name as string;
            if (typeof fn?.arguments === 'string') {
              item.arguments += fn.arguments;
              if (!item.emittedStart && item.id && item.name) {
                item.emittedStart = true;
                yield { type: 'tool_use_start', id: item.id, name: item.name };
              }
              if (item.emittedStart && fn.arguments) {
                yield { type: 'tool_use_delta', id: item.id, partial_json: fn.arguments };
              }
            } else if (!item.emittedStart && item.id && item.name) {
              item.emittedStart = true;
              yield { type: 'tool_use_start', id: item.id, name: item.name };
            }
          }
        }

        if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason;
      }
    } catch (e) {
      yield { type: 'error', message: (e as Error).message };
    }

    for (const tc of toolCalls) {
      if (tc && tc.emittedStart) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(tc.arguments || '{}');
        } catch {
          /* leave empty */
        }
        yield { type: 'tool_use_stop', id: tc.id, name: tc.name, input: parsed };
      }
    }

    const stop_reason: InternalEvent['type'] extends 'done' ? never : never =
      undefined as never;
    void stop_reason;

    yield {
      type: 'done',
      stop_reason:
        finishReason === 'tool_calls'
          ? 'tool_use'
          : finishReason === 'stop'
            ? 'end_turn'
            : finishReason === 'length'
              ? 'max_tokens'
              : 'unknown',
    };
  }

  async listModels() {
    const url = `${this.config.baseURL.replace(/\/$/, '')}/v1/models`;
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      if (!r.ok) return [];
      const j = (await r.json()) as { data?: Array<{ id: string; owned_by?: string }> };
      return (j.data || []).map((m) => ({ id: m.id, ownedBy: m.owned_by }));
    } catch {
      return [];
    }
  }
}

function toOpenAIMessages(msgs: ChatMessage[], system?: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  if (system) out.push({ role: 'system', content: system });

  for (const m of msgs) {
    if (m.role === 'system') {
      out.push({ role: 'system', content: typeof m.content === 'string' ? m.content : '' });
      continue;
    }
    if (m.role === 'tool') {
      out.push({
        role: 'tool',
        tool_call_id: m.tool_call_id,
        content: typeof m.content === 'string' ? m.content : '',
      });
      continue;
    }
    if (m.role === 'assistant') {
      if (Array.isArray(m.content)) {
        const textParts: string[] = [];
        const toolCalls: AssistantToolCall[] = [];
        for (const b of m.content) {
          if (b.type === 'text') textParts.push(b.text);
          else if (b.type === 'tool_use') {
            toolCalls.push({
              id: b.id,
              type: 'function',
              function: { name: b.name, arguments: JSON.stringify(b.input) },
            });
          }
        }
        const msg: Record<string, unknown> = { role: 'assistant' };
        msg.content = textParts.length ? textParts.join('') : null;
        if (toolCalls.length) msg.tool_calls = toolCalls;
        out.push(msg);
      } else if (m.tool_calls?.length) {
        const msg: Record<string, unknown> = { role: 'assistant', content: m.content || null };
        msg.tool_calls = m.tool_calls;
        out.push(msg);
      } else {
        out.push({ role: 'assistant', content: m.content });
      }
      continue;
    }
    if (m.role === 'user') {
      if (Array.isArray(m.content)) {
        const userParts: Array<Record<string, unknown>> = [];
        for (const b of m.content) {
          if (b.type === 'tool_result') {
            out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: b.content });
          } else if (b.type === 'text') {
            userParts.push({ type: 'text', text: b.text });
          } else if (b.type === 'image_url') {
            userParts.push({ type: 'image_url', image_url: b.image_url });
          } else if (b.type === 'document') {
            // OpenAI chat/completions does not accept raw PDF bytes.
            // Surface a placeholder so the model knows a document was attached
            // but cannot be read directly here. (PDF→image fallback should
            // happen upstream in the store before reaching this adapter.)
            userParts.push({
              type: 'text',
              text: `[Document attached: ${b.name ?? 'file'} (${b.source.media_type}); not natively readable by this model — content not shown]`,
            });
          }
        }
        if (userParts.length) {
          out.push({
            role: 'user',
            content:
              userParts.length === 1 && userParts[0].type === 'text' ? userParts[0].text : userParts,
          });
        }
      } else {
        out.push({ role: 'user', content: m.content });
      }
    }
  }
  return out;
}
