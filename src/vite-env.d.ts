/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_CONSERVATIVE_LIVE_TURN_TAKING?: string;
  readonly VITE_ENABLE_DIRECT_LIVE?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
