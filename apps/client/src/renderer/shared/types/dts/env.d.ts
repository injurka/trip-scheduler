/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_SERVER_URL: string
  readonly VITE_APP_REQUEST_THROTTLE: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
    __TAURI__?: unknown
  }
  const __APP_VERSION__: string
}

export {}
