export interface PresetModel {
  id: string;
  label: string;
  family: 'claude' | 'gpt' | 'grok' | 'other';
  note?: string;
}

export const PRESET_MODELS: PresetModel[] = [
  // Claude（自动走 AnthropicAdapter）
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', family: 'claude' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', family: 'claude' },
  { id: 'claude-opus-4-6-thinking', label: 'Claude Opus 4.6 (thinking)', family: 'claude' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', family: 'claude' },
  { id: 'claude-sonnet-4-6-thinking', label: 'Claude Sonnet 4.6 (thinking)', family: 'claude' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', family: 'claude' },

  // GPT（自动走 OpenAIAdapter）
  { id: 'gpt-5.5', label: 'GPT-5.5', family: 'gpt' },
  { id: 'gpt-5.4', label: 'GPT-5.4', family: 'gpt' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', family: 'gpt' },

  // Grok
  { id: 'grok-4', label: 'Grok 4', family: 'grok' },
  { id: 'grok-4-heavy', label: 'Grok 4 Heavy', family: 'grok' },
  { id: 'grok-4-thinking', label: 'Grok 4 (thinking)', family: 'grok' },
  { id: 'grok-4.1-fast', label: 'Grok 4.1 Fast', family: 'grok' },
];

export function findPreset(modelId: string): PresetModel | undefined {
  return PRESET_MODELS.find((m) => m.id === modelId);
}
