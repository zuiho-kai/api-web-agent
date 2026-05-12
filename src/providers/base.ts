import type { JSONSchema7 } from '@/tools/json-schema';

export type ProviderProtocol = 'openai' | 'anthropic';

// Codex-style effort levels (low / medium / high / xhigh) + off.
// xhigh is a Codex/proxy extension beyond OpenAI's official enum,
// supported by many OpenAI-compatible proxies.
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export const THINKING_LEVELS: ReadonlyArray<{ id: ThinkingLevel; label: string; note: string }> = [
  { id: 'off',    label: '关闭', note: '不强制开 thinking，让模型自己决定' },
  { id: 'low',    label: '低',   note: '轻量思考，预算 ~4k token / effort=low' },
  { id: 'medium', label: '中',   note: '中等思考，预算 ~10k token / effort=medium' },
  { id: 'high',   label: '高',   note: '深度推理，预算 ~16k token / effort=high' },
  { id: 'xhigh',  label: '超高', note: '极致推理，预算 ~32k token / effort=xhigh' },
];

// Anthropic API: thinking.budget_tokens (integer)
export const THINKING_BUDGETS: Record<ThinkingLevel, number> = {
  off: 0,
  low: 4000,
  medium: 10000,
  high: 16000,
  xhigh: 31999,
};

// OpenAI-compatible API: reasoning_effort (string enum, codex-style)
export const THINKING_EFFORT: Record<ThinkingLevel, string> = {
  off: 'minimal',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
};

export interface ProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
  protocol?: ProviderProtocol;
}

export interface ModelInfo {
  id: string;
  ownedBy?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ChatContentBlock[];
  tool_call_id?: string;
  tool_calls?: AssistantToolCall[];
}

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface AssistantToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: JSONSchema7;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  system?: string;
  tools?: ToolDef[];
  max_tokens?: number;
  temperature?: number;
  thinking?: ThinkingLevel;
}

export type InternalEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; id: string; partial_json: string }
  | { type: 'tool_use_stop'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'citation'; index: number; url: string; title?: string; quote?: string }
  | { type: 'usage'; input_tokens?: number; output_tokens?: number; cached_tokens?: number }
  | { type: 'error'; message: string; status?: number }
  | { type: 'done'; stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop' | 'unknown' };

export interface ProviderAdapter {
  readonly id: string;
  readonly protocol: ProviderProtocol;
  stream(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<InternalEvent>;
  listModels?(): Promise<ModelInfo[]>;
}
