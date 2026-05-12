import type { ProviderConfig } from '@/providers/base';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example → .env and fill in real credentials before running tests.`,
    );
  }
  return v;
}

export const PROXY_BASE_URL = (() => {
  const v = process.env.PROXY_BASE_URL;
  if (!v) {
    throw new Error(
      'Missing env var PROXY_BASE_URL. Copy .env.example → .env and set it before running tests.',
    );
  }
  return v;
})();

export const PROXY_LEGACY: ProviderConfig = {
  id: 'proxy-legacy',
  name: 'Proxy (legacy key)',
  baseURL: PROXY_BASE_URL,
  apiKey: requireEnv('PROXY_KEY_LEGACY'),
};

export const PROXY_CACHEABLE: ProviderConfig = {
  id: 'proxy-cacheable',
  name: 'Proxy (cacheable key)',
  baseURL: PROXY_BASE_URL,
  apiKey: requireEnv('PROXY_KEY_CACHEABLE'),
};
