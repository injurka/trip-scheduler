import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'
import isDev from 'electron-is-dev'

const currentDir = dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// TODO Later
// const dbPath = isDev ? 'trip-scheduler.db' : join(app.getPath('userData'), 'trip-scheduler.db')
// const db = new Database(dbPath)

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(currentDir, '../preload/index.mjs'),
      sandbox: false,
    },
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:'))
      shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    if (isDev)
      win.webContents.openDevTools()
  }
  else {
    win.loadFile(join(currentDir, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0)
    createWindow()
})

// TODO Later
// ipcMain.handle('db:query', (_, sql, params) => {
//   try {
//     const stmt = db.prepare(sql)
//     const data = stmt.all(params)
//     return { data, error: null }
//   }
//   catch (error: any) {
//     console.error('DB Query Error:', error)
//     return { data: null, error: error.message }
//   }
// })

// TODO Later
// ipcMain.handle('db:execute', (_, sql, params) => {
//   try {
//     const stmt = db.prepare(sql)
//     const info = stmt.run(params)
//     const data = { rowsAffected: info.changes, lastInsertId: info.lastInsertRowid }
//     return { data, error: null }
//   }
//   catch (error: any) {
//     console.error('DB Execute Error:', error)
//     return { data: null, error: error.message }
//   }
// })
