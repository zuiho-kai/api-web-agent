import type {
  ChatContentBlock,
  ChatMessage,
  ChatRequest,
  InternalEvent,
  ProviderAdapter,
  ToolDef,
} from '@/providers/base';
import type { ToolRegistry } from '@/tools/registry';

export type AgentEvent =
  | InternalEvent
  | { type: 'turn_start'; turn: number }
  | { type: 'turn_end'; turn: number; stop_reason: string }
  | { type: 'tool_exec_start'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_exec_done'; id: string; name: string; content: string; is_error?: boolean };

export interface AgentRunOptions {
  request: ChatRequest;
  adapter: ProviderAdapter;
  registry: ToolRegistry;
  signal?: AbortSignal;
  maxIterations?: number;
}

interface AccumulatedToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export async function* runAgent(opts: AgentRunOptions): AsyncGenerator<AgentEvent> {
  const { adapter, registry, signal } = opts;
  const maxIter = opts.maxIterations ?? 8;
  let messages = [...opts.request.messages];

  const tools: ToolDef[] = (opts.request.tools ?? registry.list().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  })));

  for (let turn = 0; turn < maxIter; turn++) {
    yield { type: 'turn_start', turn };

    let accumulatedText = '';
    const toolUses: AccumulatedToolUse[] = [];
    let stopReason = 'unknown';

    const stream = adapter.stream({ ...opts.request, messages, tools }, signal);
    for await (const ev of stream) {
      yield ev;
      if (ev.type === 'text_delta') accumulatedText += ev.text;
      if (ev.type === 'tool_use_stop') {
        toolUses.push({ id: ev.id, name: ev.name, input: ev.input });
      }
      if (ev.type === 'done') stopReason = ev.stop_reason;
    }

    yield { type: 'turn_end', turn, stop_reason: stopReason };

    if (stopReason !== 'tool_use' || toolUses.length === 0) break;

    // Build assistant message with text + tool_use blocks
    const assistantBlocks: ChatContentBlock[] = [];
    if (accumulatedText) assistantBlocks.push({ type: 'text', text: accumulatedText });
    for (const t of toolUses) {
      assistantBlocks.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input });
    }
    messages = [...messages, { role: 'assistant', content: assistantBlocks }];

    // Emit exec_start events synchronously, then run all tools in parallel
    for (const t of toolUses) {
      yield { type: 'tool_exec_start', id: t.id, name: t.name, input: t.input };
    }

    const execResults = await Promise.all(
      toolUses.map(async (t) => {
        const tool = registry.get(t.name);
        if (!tool) {
          return { id: t.id, name: t.name, text: `Tool '${t.name}' is not registered`, isError: true };
        }
        if (signal?.aborted) {
          return { id: t.id, name: t.name, text: 'Aborted', isError: true };
        }
        try {
          const results = await tool.execute(t.input, { signal });
          const text = results
            .map((r) =>
              r.type === 'text' ? r.text : r.type === 'error' ? `Error: ${r.message}` : '',
            )
            .filter(Boolean)
            .join('\n');
          return { id: t.id, name: t.name, text: text || '(empty result)', isError: false };
        } catch (e) {
          return { id: t.id, name: t.name, text: `Error: ${(e as Error).message}`, isError: true };
        }
      }),
    );

    for (const r of execResults) {
      yield {
        type: 'tool_exec_done',
        id: r.id,
        name: r.name,
        content: r.text,
        is_error: r.isError,
      };
    }

    // Append tool results as a user message (multi tool_result blocks)
    const toolResultMsg: ChatMessage = {
      role: 'user',
      content: execResults.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.id,
        content: r.text,
        is_error: r.isError,
      })),
    };
    messages = [...messages, toolResultMsg];
  }
}
