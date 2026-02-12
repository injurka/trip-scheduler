import { contextBridge, ipcRenderer } from 'electron'

// API, которое будет доступно в вашем Vue-приложении через `window.electronAPI`
const electronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
}

// Безопасно предоставляем API процессу рендеринга
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
}
catch (error) {
  console.error('Failed to expose preload API:', error)
}
