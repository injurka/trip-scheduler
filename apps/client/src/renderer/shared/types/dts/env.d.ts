/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_SERVER_URL: string
  readonly VITE_APP_REQUEST_THROTTLE: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export interface IElectronAPI {
  db: {
    query: (sql: string, params?: any[]) => Promise<{ data: any[], error: string | null }>
    execute: (sql: string, params?: any[]) => Promise<{ data: { rowsAffected: number, lastInsertId: number }, error: string | null }>
  }
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
