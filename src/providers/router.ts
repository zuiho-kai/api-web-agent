import { AnthropicAdapter } from './anthropic';
import { OpenAIAdapter } from './openai';
import type { ProviderAdapter, ProviderConfig, ProviderProtocol } from './base';

export function detectProtocol(model: string, configured?: ProviderProtocol): ProviderProtocol {
  if (configured) return configured;
  if (/^claude[-_]/i.test(model)) return 'anthropic';
  return 'openai';
}

export function buildAdapter(config: ProviderConfig, model: string): ProviderAdapter {
  const protocol = detectProtocol(model, config.protocol);
  if (protocol === 'anthropic') return new AnthropicAdapter(config);
  return new OpenAIAdapter(config);
}
