/**
 * Build-time application configuration.
 *
 * When `VITE_LOCK_PROVIDER` is "true", the app boots in **locked mode**:
 * a single hardcoded provider (from VITE_LOCKED_BASE_URL + name) is the
 * only option; users cannot add / delete / change baseURL, only fill in
 * their own API key. Used for the self-hosted deployment.
 *
 * In the public OSS build, none of these env vars are set, so lock is
 * disabled and the app behaves as a normal BYO-key multi-provider tool.
 */

export interface LockedProviderConfig {
  enabled: boolean;
  id: string;
  name: string;
  baseURL: string;
}

const enabled = String(import.meta.env.VITE_LOCK_PROVIDER ?? '').toLowerCase() === 'true';

export const LOCKED_PROVIDER: LockedProviderConfig = {
  enabled,
  id: 'locked-provider',
  name: import.meta.env.VITE_LOCKED_PROVIDER_NAME ?? 'Locked Provider',
  baseURL: import.meta.env.VITE_LOCKED_BASE_URL ?? '',
};
