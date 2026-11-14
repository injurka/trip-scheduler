import type { TripMedia } from '../src/renderer/shared/types/models/trip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportMemoryFiles, memoryExportName } from '../src/renderer/components/04.features/trip-info/trip-memories/lib/export-memories'

const native = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: native }))
vi.mock('~/shared/lib/url', () => ({ resolveApiUrl: (url: string) => `https://server.test${url}` }))
beforeEach(() => vi.resetAllMocks())
function image(id: string, name: string): TripMedia {
  return {
    id,
    name,
    originalName: name,
    url: `/original/${id}`,
    tripId: 'trip',
    fileType: 'video/mp4',
    sizeBytes: 0,
    placement: 'memories',
    createdAt: '',
  } as TripMedia
}

describe('export originals', () => {
  it('preserves extensions and keeps Unicode names within filesystem byte limits', () => {
    const fileName = memoryExportName(image('video', `${'Фото🗾'.repeat(100)}.mp4`), 'export-1')
    expect(fileName.endsWith('.mp4')).toBe(true)
    expect(new TextEncoder().encode(fileName).length).toBeLessThan(255)
    expect(memoryExportName(image('one', '../bad\\name?\n.mov'), 'export-2')).not.toMatch(/[\\/\n?]/)
  })
  it('uses the full media ID and the same destination name regardless of day order', async () => {
    native.mockResolvedValue(10)
    const first = image('12345678-first', 'same.jpg')
    const second = image('12345678-second', 'same.jpg')
    const progress = () => ({ isDownloading: true, current: 0, total: 2, loadedBytes: 0 })
    await exportMemoryFiles([first, second], '/photos', progress())
    await exportMemoryFiles([second, first], '/photos', progress())
    const names = native.mock.calls.map(([, args]) => args.fileName)
    expect(names[0]).toBe(names[3])
    expect(names[1]).toBe(names[2])
    expect(names[0]).not.toBe(names[1])
  })
  it('counts existing files as skipped and still processes new files', async () => {
    native.mockResolvedValueOnce(0).mockResolvedValueOnce(100)
    const progress = {
      isDownloading: true,
      current: 0,
      total: 2,
      loadedBytes: 0,
      skippedCount: 0,
    }
    expect(await exportMemoryFiles([image('a', 'a.jpg'), image('b', 'b.jpg')], '/photos', progress)).toBe(0)
    expect(progress).toMatchObject({ current: 2, loadedBytes: 100, skippedCount: 1 })
  })
  it('streams files sequentially, continues after failures, counts only saved bytes and uses original URLs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    native.mockResolvedValueOnce(100).mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(300)
    const progress = { isDownloading: true, current: 0, total: 3, loadedBytes: 0 }
    const failed = await exportMemoryFiles([image('a', 'a.mp4'), image('b', 'b.mp4'), image('c', 'c.mp4')], '/chosen/folder', progress)
    expect(failed).toBe(1)
    expect(progress).toMatchObject({ current: 3, total: 3, loadedBytes: 400 })
    expect(native.mock.calls[0]).toEqual(['memory_export_file', expect.objectContaining({ folder: '/chosen/folder', url: 'https://server.test/original/a', mimeType: 'video/mp4', fileName: expect.stringMatching(/^a-a\.mp4$/) })])
    expect(native.mock.calls[2][1].fileName).toMatch(/^c-c\.mp4$/)
    log.mockRestore()
  })
})
