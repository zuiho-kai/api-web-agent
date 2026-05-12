import type { ProviderConfig, ThinkingLevel } from '@/providers/base';

const KEY = 'api-web-agent/settings/v1';

/** Bump when defaults change in a way that should migrate old settings. */
const CURRENT_VERSION = 3;

const DEFAULT_MODEL = 'claude-opus-4-7';

export interface AppSettings {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  activeModel: string | null;
  modeId: string;
  thinkingLevel: ThinkingLevel;
  _version?: number;
}

const DEFAULTS: AppSettings = {
  providers: [],
  activeProviderId: null,
  activeModel: DEFAULT_MODEL,
  modeId: 'chat',
  thinkingLevel: 'high',
  _version: CURRENT_VERSION,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged: AppSettings = { ...DEFAULTS, ...parsed };

    // v2 migration: raised default thinkingLevel from 'off' → 'high'.
    if (!parsed._version || parsed._version < 2) {
      if (merged.thinkingLevel === 'off') merged.thinkingLevel = 'high';
    }

    // v3 migration: default activeModel set to claude-opus-4-7.
    // Users who never picked a model (null/empty) get upgraded.
    if (!parsed._version || parsed._version < 3) {
      if (!merged.activeModel) merged.activeModel = DEFAULT_MODEL;
    }

    merged._version = CURRENT_VERSION;
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function upsertProvider(s: AppSettings, p: ProviderConfig): AppSettings {
  const i = s.providers.findIndex((x) => x.id === p.id);
  const next = [...s.providers];
  if (i >= 0) next[i] = p;
  else next.push(p);
  return { ...s, providers: next };
}

export function removeProvider(s: AppSettings, id: string): AppSettings {
  return { ...s, providers: s.providers.filter((p) => p.id !== id), activeProviderId: s.activeProviderId === id ? null : s.activeProviderId };
}
