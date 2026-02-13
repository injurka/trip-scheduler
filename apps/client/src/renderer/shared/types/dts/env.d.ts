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
  window: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
  }
  vault: {
    selectFolder: () => Promise<string | null>
    getPath: () => Promise<string | null>
    checkFiles: (paths: string[]) => Promise<string[]>
    downloadFile: (url: string, path: string) => Promise<boolean>
    deleteFile: (path: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
