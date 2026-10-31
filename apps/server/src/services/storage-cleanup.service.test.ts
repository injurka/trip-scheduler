import { beforeEach, describe, expect, it, mock } from 'bun:test'

interface Task { id: string, keys: string[], prefix: string | null, uploadId: string | null, keepIfMediaUrl: string | null, availableAt: Date, attempts: number, lastError: string | null }
let tasks: Task[] = []
let selected: Task | undefined
const linked = new Set<string>()
const deleteFiles = mock(async (_keys: string[]) => {})
const deleteFolder = mock(async (_prefix: string) => {})
const abort = mock(async (_key: string, _uploadId: string) => {})
const tx: any = {
  select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ for: async () => {
    selected = tasks.find(task => task.availableAt <= new Date())
    return selected ? [selected] : []
  } }) }) }) }) }),
  query: { postMedia: { findFirst: async () => selected?.keepIfMediaUrl && linked.has(selected.keepIfMediaUrl) ? { id: 'linked' } : undefined } },
  delete: () => ({ where: async () => { tasks = tasks.filter(task => task.id !== selected?.id) } }),
  update: () => ({ set: (patch: Partial<Task>) => ({ where: async () => { Object.assign(selected!, patch) } }) }),
}
mock.module('db', () => ({ db: { transaction: async (fn: any) => fn(tx) } }))
mock.module('~/lib/db-monitoring', () => ({ measureDbQuery: (_table: string, _operation: string, fn: any) => fn() }))
mock.module('./s3.service', () => ({ s3Service: { deleteFiles, deleteFolder, abortMultipartUpload: abort } }))
const { processStorageCleanup, postMediaStorageKeys } = await import('./storage-cleanup.service')
function task(extra: Partial<Task> = {}): Task {
  return { id: 'task', keys: ['posts/post/original.jpg'], prefix: null, uploadId: null, keepIfMediaUrl: null, availableAt: new Date(0), attempts: 0, lastError: null, ...extra }
}
beforeEach(() => {
  tasks = []
  linked.clear()
  for (const fn of [deleteFiles, deleteFolder, abort])
    fn.mockClear()
})
describe('durable post storage cleanup', () => {
  it('collects originals, first-class variants, legacy variants and late video outputs exactly once while ignoring thumbhash', () => {
    const keys = postMediaStorageKeys({
      url: 'posts/p/movie.mov',
      variants: { poster: 'poster.webp', small: 'poster.webp', thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' },
      metadata: { variants: { web: 'web.mp4', thumbhash: 'InMBBYCHh4iIiIh/eHh3e3h4j4cI' } },
    })
    expect(keys).toEqual(['posts/p/movie.mov', 'poster.webp', 'web.mp4', 'posts/p/movie-poster.webp', 'posts/p/movie-web.mp4'])
  })
  it('retains failed cleanup in PostgreSQL and retries successfully on a later worker run', async () => {
    tasks = [task({ prefix: 'posts/post/' })]
    deleteFolder.mockRejectedValueOnce(new Error('S3 unavailable'))
    await processStorageCleanup()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].attempts).toBe(1)
    expect(tasks[0].availableAt.getTime()).toBeGreaterThan(Date.now())
    expect(deleteFiles).not.toHaveBeenCalled()
    tasks[0].availableAt = new Date(0)
    await processStorageCleanup()
    expect(tasks).toHaveLength(0)
    expect(deleteFolder).toHaveBeenCalledTimes(2)
    expect(deleteFiles).toHaveBeenCalledWith(['posts/post/original.jpg'])
  })
  it('never removes an uploaded object that is already linked to media', async () => {
    linked.add('posts/post/original.jpg')
    tasks = [task({ keepIfMediaUrl: 'posts/post/original.jpg', uploadId: 'completed-upload' })]
    await processStorageCleanup()
    expect(tasks).toHaveLength(0)
    expect(deleteFiles).not.toHaveBeenCalled()
    expect(abort).not.toHaveBeenCalled()
  })
  it('aborts abandoned multipart uploads and removes their unlinked files', async () => {
    tasks = [task({ keepIfMediaUrl: 'posts/post/original.jpg', uploadId: 'abandoned-upload' })]
    await processStorageCleanup()
    expect(abort).toHaveBeenCalledWith('posts/post/original.jpg', 'abandoned-upload')
    expect(deleteFiles).toHaveBeenCalledTimes(1)
    expect(tasks).toHaveLength(0)
  })
})
