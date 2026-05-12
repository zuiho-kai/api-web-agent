import type { ProviderConfig, ThinkingLevel } from '@/providers/base';

const KEY = 'api-web-agent/settings/v1';

export interface AppSettings {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  activeModel: string | null;
  modeId: string;
  thinkingLevel: ThinkingLevel;
}

const DEFAULTS: AppSettings = {
  providers: [],
  activeProviderId: null,
  activeModel: null,
  modeId: 'chat',
  thinkingLevel: 'off',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULTS, ...parsed };
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
