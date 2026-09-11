import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.svg'])

export function buildImageIndex(tripDir: string): Map<string, string> {
  const index = new Map<string, string>()
  const basenameOwners = new Map<string, string>()

  function addImage(root: string, fullPath: string, rawName: string): void {
    let decodedName = rawName
    try {
      decodedName = decodeURIComponent(rawName)
    }
    catch {
      // A literal '%' is valid in a filename and must not abort scanning.
    }

    const relativePath = relative(root, fullPath).replace(/\\/g, '/')
    for (const key of [relativePath, relativePath.toLowerCase()])
      index.set(key, fullPath)

    const base = basename(decodedName)
    for (const key of [base, base.toLowerCase()]) {
      const owner = basenameOwners.get(key)
      if (owner && owner !== fullPath) {
        // Empty value explicitly marks an ambiguous basename. Callers may still
        // resolve the image by its vault-relative path.
        index.set(key, '')
      }
      else {
        basenameOwners.set(key, fullPath)
        index.set(key, fullPath)
      }
    }
  }

  function walk(root: string, current: string): void {
    if (!existsSync(current))
      return

    try {
      const entries = readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(current, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules')
            walk(root, fullPath)
          continue
        }
        if (!entry.isFile())
          continue
        const extension = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()
        if (IMAGE_EXTENSIONS.has(extension))
          addImage(root, fullPath, entry.name)
      }
    }
    catch {
      // An unreadable directory must not prevent indexing its siblings.
    }
  }

  walk(tripDir, tripDir)

  const parentDir = dirname(tripDir)
  if (parentDir && existsSync(parentDir)) {
    for (const folder of ['_', 'attachments', 'assets', 'images', 'media', 'files']) {
      const candidate = join(parentDir, folder)
      if (existsSync(candidate) && statSync(candidate).isDirectory())
        walk(candidate, candidate)
    }
  }

  return index
}
