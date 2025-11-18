import { contextBridge, ipcRenderer } from 'electron'

// API, которое будет доступно в вашем Vue-приложении через `window.electronAPI`
const electronAPI = {
  db: {
    query: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
    execute: (sql: string, params?: any[]) => ipcRenderer.invoke('db:execute', sql, params),
  },
}

// Безопасно предоставляем API процессу рендеринга
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
}
catch (error) {
  console.error('Failed to expose preload API:', error)
}
