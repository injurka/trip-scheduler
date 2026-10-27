import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { createPinia, setActivePinia } from 'pinia'

const create = mock(async (_data: unknown) => ({ id: 'server-post' }))
const upload = mock(async (file: File, postId: string, ..._args: unknown[]) => ({ id: file.name, url: `posts/${postId}/${file.name}`, originalName: file.name }))
const remove = mock(async (_input: unknown) => ({ success: true }))
const update = mock(async (_input: unknown) => ({ id: 'server-post' }))
const getById = mock(async (_input: unknown) => ({ media: [] as any[] }))
const deletePost = mock(async (_input: unknown) => ({ id: 'server-post' }))
const api = { posts: { create, deleteMedia: remove, update, getById, delete: deletePost }, files: { uploadFile: upload } }
mock.module('~/plugins/request', () => ({
  useRequest: async (options: any) => {
    try {
      const result = await options.fn(api)
      options.onSuccess?.(result)
      return result
    }
    catch (error) {
      options.onError?.({ error: { customMessage: String(error) } })
      return null
    }
  },
}))
mock.module('~/shared/composables/use-toast', () => ({ useToast: () => ({ error: () => {}, success: () => {} }) }))
mock.module('../src/renderer/components/05.modules/post/store/post.store', () => ({ EPostRequestKeys: { CREATE: 'create', UPDATE: 'update' } }))
const { usePostDraftStore } = await import('../src/renderer/components/05.modules/post/store/post-draft.store')

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of [create, upload, remove, update, getById, deletePost])
    fn.mockClear()
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } })
})
describe('post media ownership and draft recovery', () => {
  it('links concurrent uploads to exactly one server draft and preserves capture metadata', async () => {
    const store = usePostDraftStore()
    await Promise.all([store.uploadSingleMedia(new File([''], 'IMG_20261104_090000.jpg')), store.uploadSingleMedia(new File([''], 'IMG_20261104_100000.jpg'))])
    expect(create).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls.map(call => call[1])).toEqual(['server-post', 'server-post'])
    expect(upload.mock.calls[0][6]).toMatchObject({ capturedAt: '2026-11-04T09:00:00' })
    expect(store.post.media).toHaveLength(2)
    expect(store.activeUploads).toBe(0)
  })
  it('does not save an invisible initial placeholder as a timeline activity', async () => {
    const store = usePostDraftStore()
    expect(store.post.stages).toHaveLength(0)
    store.post.stages = [{ id: 'legacy-placeholder', title: 'Начало', day: 1, time: '', order: 0, blocks: [] }]
    await store.savePost(true, 'draft')
    expect((update.mock.calls[0][0] as any).data.elements).toEqual([])
  })
  it('saves gallery references without uploading the files again', async () => {
    const store = usePostDraftStore()
    const media = await store.uploadSingleMedia(new File([''], 'IMG_20261104_090000.jpg'))
    store.post.stages = [{ id: 'stage', title: 'Прогулка', day: 1, time: '09:00', order: 0, blocks: [{ id: 'gallery', type: 'gallery', images: [media!] }] }]
    await store.savePost(true, 'draft')
    const payload = update.mock.calls[0][0] as any
    expect(payload.data.status).toBe('draft')
    expect(payload.data.mediaIds).toEqual([media!.id])
    expect(payload.data.elements[0].content[0].imageIds).toEqual([media!.id])
    expect(create).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledTimes(1)
  })
  it('keeps local gallery references when deleting media fails', async () => {
    const store = usePostDraftStore()
    const media = { id: 'media', type: 'image' as const, url: 'posts/post/photo.jpg' }
    store.post.media = [media]
    store.post.stages = [{ id: 'stage', title: '', order: 0, blocks: [{ id: 'gallery', type: 'gallery', images: [media] }] }]
    remove.mockRejectedValueOnce(new Error('Offline'))
    expect(await store.removeGlobalMedia('media')).toBe(false)
    expect(store.post.media).toHaveLength(1)
    expect(JSON.parse(JSON.stringify(store.post.stages[0].blocks[0]))).toMatchObject({ images: [media] })
    expect(await store.removeGlobalMedia('media')).toBe(true)
    expect(store.post.media).toHaveLength(0)
    expect(JSON.parse(JSON.stringify(store.post.stages[0].blocks[0]))).toMatchObject({ images: [] })
  })
  it('recovers server uploads and refreshes gallery metadata after reopening', async () => {
    const store = usePostDraftStore()
    store.createdServerId = 'server-post'
    const old = { id: 'old', type: 'image' as const, url: 'old.jpg' }
    store.post.media = [old]
    store.post.stages = [{ id: 'stage', title: '', order: 0, blocks: [{ id: 'gallery', type: 'gallery', images: [old] }] }]
    getById.mockResolvedValueOnce({ media: [{ ...old, variants: { small: 'small.webp' } }, { id: 'recovered', type: 'video', url: 'movie.mp4' }] })
    await store.refreshMedia()
    expect(store.post.media).toHaveLength(2)
    expect(JSON.parse(JSON.stringify(store.post.stages[0].blocks[0]))).toMatchObject({ images: [{ ...old, variants: { small: 'small.webp' } }] })
  })
  it('keeps the draft after a failed delete and clears it only after server success', async () => {
    const store = usePostDraftStore()
    store.createdServerId = 'server-post'
    localStorage.setItem('trip_scheduler_post_draft_new', 'cached')
    deletePost.mockRejectedValueOnce(new Error('Offline'))
    expect(await store.discardDraft()).toBe(false)
    expect(store.createdServerId).toBe('server-post')
    expect(localStorage.getItem('trip_scheduler_post_draft_new')).toBe('cached')
    expect(await store.discardDraft()).toBe(true)
    expect(store.createdServerId).toBeNull()
    expect(localStorage.getItem('trip_scheduler_post_draft_new')).toBeNull()
  })
})
