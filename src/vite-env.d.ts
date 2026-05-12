/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCK_PROVIDER?: string;
  readonly VITE_LOCKED_BASE_URL?: string;
  readonly VITE_LOCKED_PROVIDER_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*?url' {
  const url: string;
  export default url;
}
