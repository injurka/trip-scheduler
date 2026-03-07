import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  vault: {
    selectFolder: () => ipcRenderer.invoke('vault:select-folder'),
    getPath: () => ipcRenderer.invoke('vault:get-path'),
    checkFiles: (paths: string[]) => ipcRenderer.invoke('vault:check-files', paths),
    downloadFile: (url: string, path: string) => ipcRenderer.invoke('vault:download-file', url, path),
    deleteFile: (path: string) => ipcRenderer.invoke('vault:delete-file', path),
  },
}

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
}
catch (error) {
  console.error('Failed to expose preload API:', error)
}
