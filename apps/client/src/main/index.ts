import fs from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import process from 'node:process'
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
      const savedPath = data.vaultPath || null
      // Проверяем, существует ли путь физически (важно для Portable режима)
      if (savedPath && !fs.existsSync(savedPath)) {
        return null
      }
      return savedPath
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
protocol.registerSchemesAsPrivileged([
  { scheme: 'trip-scheduler-vault', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true, stream: true } },
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
  // Handle Custom Protocol: отдаем файлы из папки
  protocol.handle('trip-scheduler-vault', (request) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return new Response('Vault path not configured', { status: 404 })
    }

    const urlPath = request.url.replace('trip-scheduler-vault://', '')
    const decodedPath = decodeURIComponent(urlPath)

    // Формируем полный путь к файлу на диске
    const finalPath = normalize(join(vaultPath, decodedPath))

    // Защита от выхода за пределы папки (Path Traversal)
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
    title: 'Выберите папку для хранения фотографий',
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

  const existing: string[] = []

  // Проверяем наличие файлов параллельно
  await Promise.all(relativePaths.map(async (relPath) => {
    const fullPath = join(root, relPath)
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK)
      existing.push(relPath)
    }
    catch {
      // файл отсутствует
    }
  }))

  return existing
})

ipcMain.handle('vault:download-file', async (_, url: string, relativePath: string) => {
  const root = getVaultPath()
  if (!root)
    throw new Error('Vault not set')

  // Нормализуем путь (важно для Windows: '/' -> '\')
  const fullDest = normalize(join(root, relativePath))
  const dir = dirname(fullDest)

  // 1. Создаем папку (это работает, судя по описанию)
  try {
    await fs.promises.mkdir(dir, { recursive: true })
  }
  catch (err) {
    console.error('Failed to create directory:', dir, err)
    throw err
  }

  // 2. Скачиваем файл через electron.net (надежнее чем Node fetch)
  console.log(`[Vault] Downloading: ${url} -> ${fullDest}`)

  return new Promise((resolve, reject) => {
    const request = net.request(url)

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        console.error(`[Vault] Failed download ${url}: HTTP ${response.statusCode}`)
        reject(new Error(`Status: ${response.statusCode}`))
        return
      }

      // Создаем поток записи в файл
      const fileStream = fs.createWriteStream(fullDest)

      // Пайпим ответ сети сразу в файл
      response.pipe(fileStream)

      fileStream.on('finish', () => {
        // Закрываем файл после записи
        fileStream.close(() => {
          console.log(`[Vault] Saved: ${fullDest}`)
          resolve(true)
        })
      })

      fileStream.on('error', (err) => {
        console.error(`[Vault] Write error for ${fullDest}:`, err)
        // Удаляем битый файл, если не удалось записать
        fs.unlink(fullDest, () => { })
        reject(err)
      })
    })

    request.on('error', (err) => {
      console.error(`[Vault] Network error for ${url}:`, err)
      reject(err)
    })

    // Завершаем формирование запроса
    request.end()
  })
})

ipcMain.handle('vault:delete-file', async (_, relativePath: string) => {
  const root = getVaultPath()
  if (!root)
    return
  const fullPath = join(root, relativePath)
  try {
    await fs.promises.unlink(fullPath)
  }
  catch (e) {
    console.error('Delete failed', e)
  }
})
