import fs from 'node:fs'
import path, { dirname, join, normalize } from 'node:path'

import process from 'node:process'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import isDev from 'electron-is-dev'

const currentDir = dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// --- Vault Settings Helper ---
const SETTINGS_FILE = join(app.getPath('userData'), 'vault-settings.json')

function getVaultPath(): string | null {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
      return data.vaultPath || null
    }
  }
  catch (e) {
    console.error('Failed to read vault settings', e)
  }
  return null
}

function saveVaultPath(vaultPath: string) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ vaultPath }))
}

// --- Protocol Registration ---
// Важно зарегистрировать до события ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'trip-scheduler-vault', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(currentDir, '../preload/index.mjs'),
      sandbox: false,
      webSecurity: true,
    },
    show: false,
    autoHideMenuBar: true,
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

app.whenReady().then(() => {
  // Handle Custom Protocol
  protocol.handle('trip-scheduler-vault', (request) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return new Response('Vault path not configured', { status: 404 })
    }

    // URL: trip-scheduler-vault://TRIP_UUID/days/DAY_UUID/IMG.jpg
    const url = request.url.replace('trip-scheduler-vault://', '')
    // Декодируем URL (на случай пробелов и спецсимволов) и нормализуем путь
    const relativePath = decodeURIComponent(url)
    const finalPath = normalize(join(vaultPath, 'trips', relativePath))

    // Security check: ensure we are not going outside vaultPath
    if (!finalPath.startsWith(vaultPath)) {
      return new Response('Access denied', { status: 403 })
    }

    return net.fetch(`file://${finalPath}`)
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0)
    createWindow()
})

// --- IPC Handlers for Window ---
ipcMain.handle('window:minimize', () => {
  const win = BrowserWindow.getFocusedWindow()
  win?.minimize()
})

ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win?.isMaximized()) {
    win.unmaximize()
  }
  else {
    win?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  const win = BrowserWindow.getFocusedWindow()
  win?.close()
})

// --- IPC Handlers for Vault ---

ipcMain.handle('vault:select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || filePaths.length === 0)
    return null

  const path = filePaths[0]
  saveVaultPath(path)
  return path
})

ipcMain.handle('vault:get-path', () => {
  return getVaultPath()
})

ipcMain.handle('vault:check-files', async (_, relativePaths: string[]) => {
  const root = getVaultPath()
  if (!root)
    return []

  // Возвращаем список путей, которые существуют на диске
  const existing: string[] = []
  for (const relPath of relativePaths) {
    const fullPath = join(root, 'trips', relPath)
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK)
      existing.push(relPath)
    }
    catch {
      // file not found
    }
  }
  return existing
})

ipcMain.handle('vault:download-file', async (_, url: string, relativePath: string) => {
  const root = getVaultPath()
  if (!root)
    throw new Error('Vault not set')

  const fullDest = join(root, 'trips', relativePath)
  const dir = path.dirname(fullDest)

  try {
    await fs.promises.mkdir(dir, { recursive: true })

    // Используем fetch для скачивания (Node 18+)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    if (!response.body)
      throw new Error('No body')

    const fileStream = fs.createWriteStream(fullDest)

    // @ts-ignore - stream web vs node typings
    await pipeline(response.body, fileStream)

    return true
  }
  catch (error) {
    console.error('Download failed:', error)
    // Clean up partial file if needed
    try { await fs.promises.unlink(fullDest) }
    catch { }
    throw error
  }
})

ipcMain.handle('vault:delete-file', async (_, relativePath: string) => {
  const root = getVaultPath()
  if (!root)
    return
  const fullPath = join(root, 'trips', relativePath)
  try {
    await fs.promises.unlink(fullPath)
  }
  catch (e) {
    console.error('Delete failed', e)
  }
})
