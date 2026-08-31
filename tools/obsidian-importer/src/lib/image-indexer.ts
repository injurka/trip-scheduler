import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function buildImageIndex(tripDir: string): Map<string, string> {
  const index = new Map<string, string>()

  function walk(current: string) {
    if (!existsSync(current))
      return

    try {
      const entries = readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(current, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(fullPath)
          }
        }
        else if (entry.isFile()) {
          const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()
          if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.svg'].includes(ext)) {
            index.set(entry.name, fullPath)
            index.set(entry.name.toLowerCase(), fullPath)
            index.set(decodeURIComponent(entry.name), fullPath)
            index.set(decodeURIComponent(entry.name).toLowerCase(), fullPath)
          }
        }
      }
    }
    catch {
      // ignore
    }
  }

  walk(tripDir)

  // Also check parent attachments / assets folders
  const parentDir = dirname(tripDir)
  if (parentDir && existsSync(parentDir)) {
    const candidateFolders = ['_attachments', 'attachments', 'assets', 'images', 'media', 'files']
    for (const folder of candidateFolders) {
      const p = join(parentDir, folder)
      if (existsSync(p) && statSync(p).isDirectory()) {
        walk(p)
      }
    }
  }

  return index
}
