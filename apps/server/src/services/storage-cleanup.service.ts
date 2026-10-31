import { db } from 'db'
import { postMedia, storageCleanupTasks } from 'db/schema'
import { eq, lte } from 'drizzle-orm'
import { measureDbQuery } from '~/lib/db-monitoring'
import { s3Service } from './s3.service'

type CleanupTask = typeof storageCleanupTasks.$inferSelect
export type CleanupInput = typeof storageCleanupTasks.$inferInsert

function extractVariantStorageKeys(variants?: Record<string, string> | null): string[] {
  if (!variants)
    return []
  return Object.entries(variants)
    .filter(([key, value]) => key !== 'thumbhash' && Boolean(value))
    .map(([, value]) => value)
}

export function postMediaStorageKeys(media: { url: string, variants?: Record<string, string> | null, metadata?: unknown }): string[] {
  const metadata = media.metadata as { variants?: Record<string, string> } | null
  // Include deterministic video outputs even if deletion races with transcoding.
  const base = media.url.replace(/\.[^/.]+$/, '')
  return [...new Set([media.url, ...extractVariantStorageKeys(media.variants), ...extractVariantStorageKeys(metadata?.variants), `${base}-poster.webp`, `${base}-web.mp4`].filter(Boolean))]
}

export async function queueStorageCleanup(input: CleanupInput) {
  return measureDbQuery('storageCleanupTasks', 'insert', async () => {
    const [task] = await db.insert(storageCleanupTasks).values(input).returning()
    return task
  })
}

// Called before uploading so even a process crash cannot lose the cleanup reference.
export async function trackPendingPostUpload(keys: string[], originalUrl: string, uploadId?: string) {
  return queueStorageCleanup({ keys, keepIfMediaUrl: originalUrl, uploadId, availableAt: new Date(Date.now() + 86400000) })
}

export async function executeStorageCleanup(task: Pick<CleanupTask, 'keys' | 'prefix' | 'uploadId'>) {
  if (task.uploadId && task.keys[0]) {
    try {
      await s3Service.abortMultipartUpload(task.keys[0], task.uploadId)
    }
    catch (error: any) {
      if (error.name !== 'NoSuchUpload')
        throw error
    }
  }
  if (task.prefix)
    await s3Service.deleteFolder(task.prefix)
  if (task.keys.length)
    await s3Service.deleteFiles(task.keys)
}

let running = false
export async function processStorageCleanup() {
  if (running)
    return
  running = true
  try {
    for (let i = 0; i < 30; i++) {
      const found = await measureDbQuery('storageCleanupTasks', 'delete', () => db.transaction(async (tx) => {
        const [task] = await tx.select().from(storageCleanupTasks).where(lte(storageCleanupTasks.availableAt, new Date())).orderBy(storageCleanupTasks.availableAt).limit(1).for('update', { skipLocked: true })
        if (!task)
          return false
        try {
          const linked = task.keepIfMediaUrl
            ? await tx.query.postMedia.findFirst({ where: eq(postMedia.url, task.keepIfMediaUrl), columns: { id: true } })
            : undefined
          if (!linked)
            await executeStorageCleanup(task)
          await tx.delete(storageCleanupTasks).where(eq(storageCleanupTasks.id, task.id))
        }
        catch (error) {
          await tx.update(storageCleanupTasks).set({
            attempts: task.attempts + 1,
            lastError: String(error).slice(0, 2000),
            availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(task.attempts, 7))),
          }).where(eq(storageCleanupTasks.id, task.id))
          console.error('[StorageCleanup] Cleanup will be retried', task.id, error)
        }
        return true
      }))
      if (!found)
        break
    }
  }
  catch (error) {
    console.error('[StorageCleanup] Worker failed; tasks remain in PostgreSQL', error)
  }
  finally { running = false }
}
