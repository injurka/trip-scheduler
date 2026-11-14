import type { TripMedia } from '../src/renderer/shared/types/models/trip'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { useTripMemoriesVault } from '../src/renderer/components/04.features/trip-info/trip-memories/composables/use-trip-memories-vault'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  module: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mobile: false,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('~/shared/lib/env', () => ({
  isTauri: true,
  get isMobileApp() {
    return mocks.mobile
  },
}))
vi.mock('~/shared/lib/url', () => ({ resolveApiUrl: (url: string) => url }))
vi.mock('~/shared/composables/use-toast', () => ({ useToast: () => mocks }))
vi.mock('~/components/05.modules/trip-info/composables/use-trip-info-module', () => ({ useModuleStore: mocks.module }))

const useMemories = defineStore('test-memories', {
  state: () => ({ memoriesForSelectedDay: [] as { image?: TripMedia }[] }),
})
function photo(id: string) {
  return { image: { id, originalName: `${id}.jpg`, url: `https://test/${id}`, fileType: 'image/jpeg' } as TripMedia }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.mobile = false
  setActivePinia(createPinia())
  mocks.module.mockReturnValue({ plan: { currentTripId: 'trip' }, memories: useMemories() })
})

describe('android background download handler', () => {
  function status(isDownloading: boolean, overrides = {}) {
    return {
      id: 'native-job',
      isDownloading,
      total: 2,
      current: isDownloading ? 0 : 2,
      loadedBytes: isDownloading ? 0 : 100,
      skippedCount: isDownloading ? 0 : 1,
      failed: 0,
      cancelled: false,
      ...overrides,
    }
  }

  it('hands the whole day to Android once and only polls progress after that', async () => {
    vi.useFakeTimers()

    try {
      mocks.mobile = true
      const memories = useMemories()
      memories.memoriesForSelectedDay = [photo('one'), photo('two'), photo('one')]
      mocks.invoke.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(status(true)).mockResolvedValueOnce(status(false))
      const first = useTripMemoriesVault()
      const running = first.handleDownloadVault()
      await vi.advanceTimersByTimeAsync(0)
      expect(first.syncState.value.isDownloading).toBe(true)
      memories.memoriesForSelectedDay = [photo('another-day')]
      await useTripMemoriesVault().handleDownloadVault()
      expect(mocks.invoke.mock.calls.map(([command]) => command)).toEqual([
        'tracking_request_notification_permission',
        'memory_export_start',
        'memory_export_status',
      ])
      expect(mocks.invoke.mock.calls[1][1].files).toEqual([
        expect.objectContaining({ fileName: 'one-one.jpg' }),
        expect.objectContaining({ fileName: 'two-two.jpg' }),
      ])
      // The native queue can complete while JS is suspended; the next poll reads its result.
      await vi.advanceTimersByTimeAsync(750)
      await running
      expect(first.syncState.value).toMatchObject({ isDownloading: false, current: 2, skippedCount: 1, loadedBytes: 100 })
      expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('Уже на устройстве: 1'))
    }
    finally { vi.useRealTimers() }
  })

  it('does not start the service when notifications are denied', async () => {
    mocks.mobile = true
    useMemories().memoriesForSelectedDay = [photo('one')]
    mocks.invoke.mockResolvedValueOnce(false)
    const view = useTripMemoriesVault()
    await view.handleDownloadVault()
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    expect(view.syncState.value.isDownloading).toBe(false)
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Разрешите уведомления'))
  })

  it('reports cancellation from the notification without claiming all files were saved', async () => {
    mocks.mobile = true
    useMemories().memoriesForSelectedDay = [photo('one')]
    mocks.invoke.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(status(false, { cancelled: true, current: 1 }))
    await useTripMemoriesVault().handleDownloadVault()
    expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('остановлено'))
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('unlocks the button if Android rejects foreground service startup', async () => {
    mocks.mobile = true
    useMemories().memoriesForSelectedDay = [photo('one')]
    mocks.invoke.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('foreground service unavailable'))
    const view = useTripMemoriesVault()
    await view.handleDownloadVault()
    expect(view.syncState.value.isDownloading).toBe(false)
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('foreground service unavailable'))
    expect(mocks.invoke).toHaveBeenCalledTimes(2)
  })

  it('shows the Android timeout message instead of reporting success', async () => {
    mocks.mobile = true
    useMemories().memoriesForSelectedDay = [photo('one')]
    mocks.invoke.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(status(false, { error: 'Android остановил длительное скачивание' }))
    await useTripMemoriesVault().handleDownloadVault()
    expect(mocks.error).toHaveBeenCalledWith('Android остановил длительное скачивание')
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('reports an interrupted native process and allows a retry', async () => {
    vi.useFakeTimers()

    try {
      mocks.mobile = true
      useMemories().memoriesForSelectedDay = [photo('one')]
      mocks.invoke.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(status(true)).mockResolvedValueOnce({ isDownloading: false, total: 0 })
      const view = useTripMemoriesVault()
      const running = view.handleDownloadVault()
      await vi.advanceTimersByTimeAsync(750)
      await running
      expect(view.syncState.value.isDownloading).toBe(false)
      expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('скачивание прервано'))
      expect(mocks.success).not.toHaveBeenCalled()
    }
    finally { vi.useRealTimers() }
  })

  it('recovers native progress after the memories screen is recreated', async () => {
    vi.useFakeTimers()
    mocks.mobile = true
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    mocks.invoke.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(status(false))
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup() {
        useTripMemoriesVault()

        return () => h('div')
      },
    }))

    try {
      app.mount(host)
      await vi.advanceTimersByTimeAsync(0)
      expect(useTripMemoriesVault().syncState.value.isDownloading).toBe(true)
      app.unmount()
      await vi.advanceTimersByTimeAsync(750)
      expect(useTripMemoriesVault().syncState.value.isDownloading).toBe(false)
      expect(mocks.invoke.mock.calls.every(([command]) => command === 'memory_export_status')).toBe(true)
      expect(mocks.success).toHaveBeenCalledTimes(1)
    }
    finally { vi.useRealTimers() }
  })
})

describe('download button handler', () => {
  it('returns to the first day and skips existing files; retries failed or deleted files', async () => {
    // Model the native contract: zero = present on disk, rejected = failed save.
    const files = new Set<string>()
    const transfers: string[] = []
    let fail = false
    mocks.invoke.mockImplementation(async (command, args) => {
      if (command === 'memory_export_folder')
        return '/photos'

      const key = `${args.folder}/${args.fileName}`

      if (files.has(key))
        return 0

      if (fail)
        throw new Error('disk full')

      files.add(key)
      transfers.push(key)

      return 100
    })
    const memories = useMemories()
    const first = useTripMemoriesVault()
    memories.memoriesForSelectedDay = [photo('day1'), photo('day1')]
    await first.handleDownloadVault()
    memories.memoriesForSelectedDay = [photo('day2')]
    await useTripMemoriesVault().handleDownloadVault()
    memories.memoriesForSelectedDay = [photo('day1')]
    const returned = useTripMemoriesVault()
    await returned.handleDownloadVault()
    expect(transfers).toHaveLength(2)
    expect(returned.syncState.value).toMatchObject({ current: 1, skippedCount: 1, loadedBytes: 0, isDownloading: false })
    expect(mocks.success).toHaveBeenLastCalledWith(expect.stringContaining('Уже на устройстве: 1'))
    files.clear()
    fail = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await returned.handleDownloadVault()
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Не удалось скачать: 1'))
    expect(returned.syncState.value.isDownloading).toBe(false)
    fail = false
    await returned.handleDownloadVault()
    expect(transfers).toHaveLength(3)
    log.mockRestore()
  })

  it('locks across views before the dialog, snapshots the day, and unlocks after cancellation', async () => {
    const dialog = deferred<string | null>()
    mocks.invoke.mockReturnValueOnce(dialog.promise).mockResolvedValue(100)
    const memories = useMemories()
    memories.memoriesForSelectedDay = [photo('first')]
    const first = useTripMemoriesVault()
    const running = first.handleDownloadVault()
    memories.memoriesForSelectedDay = [photo('second')]
    await useTripMemoriesVault().handleDownloadVault()
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    dialog.resolve('/photos')
    await running
    expect(mocks.invoke).toHaveBeenLastCalledWith('memory_export_file', expect.objectContaining({ fileName: 'first-first.jpg' }))
    mocks.invoke.mockResolvedValueOnce(null)
    await first.handleDownloadVault()
    expect(first.syncState.value.isDownloading).toBe(false)
  })

  it('downloads into a different folder and does nothing for an empty day', async () => {
    const view = useTripMemoriesVault()
    await view.handleDownloadVault()
    expect(mocks.invoke).not.toHaveBeenCalled()
    useMemories().memoriesForSelectedDay = [photo('first')]
    mocks.invoke.mockResolvedValueOnce('/first-folder').mockResolvedValueOnce(0).mockResolvedValueOnce('/another-folder').mockResolvedValueOnce(100)
    await view.handleDownloadVault()
    await view.handleDownloadVault()
    expect(mocks.invoke).toHaveBeenLastCalledWith('memory_export_file', expect.objectContaining({ folder: '/another-folder', fileName: 'first-first.jpg' }))
    expect(view.syncState.value).toMatchObject({ skippedCount: 0, loadedBytes: 100, isDownloading: false })
  })

  it('unlocks and reports a folder dialog error', async () => {
    useMemories().memoriesForSelectedDay = [photo('first')]
    mocks.invoke.mockRejectedValueOnce(new Error('dialog failed'))
    const view = useTripMemoriesVault()
    await view.handleDownloadVault()
    expect(view.syncState.value.isDownloading).toBe(false)
    expect(mocks.error).toHaveBeenCalledWith('Error: dialog failed')
  })
})
