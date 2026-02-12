import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
}

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
}
catch (error) {
  console.error('Failed to expose preload API:', error)
}
