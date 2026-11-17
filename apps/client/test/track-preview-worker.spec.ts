import type {
  PreviewRequest,
  PreviewResponse,
} from '../src/renderer/components/04.features/day-track-player/lib/track-preview.worker'
import type { DayData } from '../src/renderer/components/04.features/day-track-player/models/types'
import { describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { useTrackCorrectionDrafts } from '../src/renderer/components/04.features/day-track-player/composables/use-track-correction-drafts'
import { createTrackPreviewProcessor } from '../src/renderer/components/04.features/day-track-player/lib/track-preview-client'

class FakeWorker {
  onmessage: ((event: MessageEvent<PreviewResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  messages: PreviewRequest[] = []
  terminate = vi.fn()
  postMessage(message: PreviewRequest) {
    this.messages.push(structuredClone(message))
  }

  reply(data: DayData) {
    this.onmessage?.({
      data: { id: this.messages.at(-1)!.id, data },
    } as MessageEvent<PreviewResponse>)
  }
}
const base: DayData = {
  points: [],
  rawPoints: [],
  corrections: [],
  segments: [],
}
function fixture() {
  const workers: FakeWorker[] = []
  const processor = createTrackPreviewProcessor(() => {
    const worker = new FakeWorker()
    workers.push(worker)

    return worker as unknown as Worker
  })

  return { workers, processor }
}

describe('preview worker lifecycle', () => {
  it('clones a reactive day only once and sends only corrections on later edits', async () => {
    const { workers, processor } = fixture()
    const day = reactive({ ...base })
    const first = processor.process(day, [])
    expect(workers[0].messages[0].base).toEqual(base)
    workers[0].reply(base)
    await first
    const next = processor.process(day, [])
    expect(workers).toHaveLength(1)
    expect(workers[0].messages[1].base).toBeUndefined()
    workers[0].reply(base)
    await next
    processor.cancel()
  })
  it('cancels obsolete calculations and ignores late worker failures/results', async () => {
    const { workers, processor } = fixture()
    const first = processor.process(base, [])
    const firstFailure = expect(first).rejects.toThrow('отменён')
    const onOldError = workers[0].onerror!
    const onOldMessage = workers[0].onmessage!
    const next = processor.process({ ...base }, [])
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    onOldError({ preventDefault: vi.fn() } as unknown as ErrorEvent)
    onOldMessage({
      data: { id: workers[0].messages[0].id, data: base },
    } as MessageEvent<PreviewResponse>)
    workers[1].reply(base)
    expect(await next).toEqual(base)
    await firstFailure
    processor.cancel()
  })
  it('rejects a worker startup failure instead of leaving the UI pending forever', async () => {
    const processor = createTrackPreviewProcessor(() => {
      throw new Error('worker blocked')
    })
    await expect(processor.process(base, [])).rejects.toThrow('worker blocked')
  })
  it('fails timed out work, terminates it and can retry from the full day', async () => {
    vi.useFakeTimers()

    try {
      const { workers, processor } = fixture()
      const request = processor.process(base, [])
      const failure = expect(request).rejects.toThrow('слишком много времени')
      await vi.advanceTimersByTimeAsync(120000)
      await failure
      expect(workers[0].terminate).toHaveBeenCalledOnce()
      const next = processor.process(base, [])
      expect(workers[1].messages[0].base).toEqual(base)
      workers[1].reply(base)
      await next
      processor.cancel()
    }
    finally {
      vi.useRealTimers()
    }
  })
})

it('keeps drafts atomic on failure and reactively publishes the successful preview', async () => {
  const computedDay = { ...base, timeZone: 'Asia/Taipei' }
  const process = vi
    .fn()
    .mockRejectedValueOnce(new Error('calculation failed'))
    .mockResolvedValue(computedDay)
  const drafts = useTrackCorrectionDrafts({ process, cancel: vi.fn() })
  const view = computed(() => drafts.preview(base))
  expect(view.value).toBe(base)
  const choice = {
    sessionId: 'recording',
    startedAt: 1000,
    endedAt: 2000,
    activity: 'walk' as const,
  }
  await expect(drafts.stage(choice, base)).rejects.toThrow('calculation failed')
  expect(drafts.count.value).toBe(0)
  expect(drafts.processing.value).toBe(false)
  expect(view.value).toBe(base)
  await drafts.stage(choice, base)
  expect(drafts.count.value).toBe(1)
  expect(view.value.timeZone).toBe('Asia/Taipei')
  drafts.clear()
  expect(view.value).toBe(base)
})

it('does not commit a late result after clearing the day', async () => {
  let resolve!: (day: DayData) => void
  const drafts = useTrackCorrectionDrafts({
    process: () =>
      new Promise((r) => {
        resolve = r
      }),
    cancel: vi.fn(),
  })
  const request = drafts.stage({ sessionId: 'session', startedAt: 1000, endedAt: 2000, activity: 'walk' }, base)
  const failure = expect(request).rejects.toThrow('отменён')
  drafts.clear()
  resolve({ ...base })
  await failure
  expect(drafts.count.value).toBe(0)
  expect(drafts.preview(base)).toBe(base)
})
