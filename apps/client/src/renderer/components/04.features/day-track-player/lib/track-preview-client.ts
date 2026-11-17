import type { ActivityCorrection } from '@limiteddissolve/track-processing'
import type { DayData } from '../models/types'
import type { PreviewRequest, PreviewResponse } from './track-preview.worker'
import { toRaw } from 'vue'

export interface TrackPreviewProcessor {
  process: (
    base: DayData,
    corrections: ActivityCorrection[],
  ) => Promise<DayData>
  cancel: () => void
}

export function createTrackPreviewProcessor(createWorker = () =>
  new Worker(new URL('./track-preview.worker.ts', import.meta.url), {
    type: 'module',
  })): TrackPreviewProcessor {
  let worker: Worker | null = null
  let loadedBase: DayData | null = null
  let sequence = 0
  let pending: {
    id: number
    resolve: (data: DayData) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  } | null = null
  function cancel() {
    if (pending)
      clearTimeout(pending.timeout)

    worker?.terminate()
    worker = null
    loadedBase = null
    pending?.reject(new Error('Пересчёт отменён'))
    pending = null
  }
  function fail(message: string) {
    const request = pending

    if (request)
      clearTimeout(request.timeout)

    pending = null
    cancel()
    request?.reject(new Error(message))
  }
  function initialize() {
    worker = createWorker()
    const currentWorker = worker
    worker.onmessage = ({ data }: MessageEvent<PreviewResponse>) => {
      if (worker !== currentWorker || !pending || pending.id !== data.id)
        return

      const request = pending
      clearTimeout(request.timeout)
      pending = null

      if ('error' in data) {
        cancel()
        request.reject(new Error(data.error))
      }
      else {
        request.resolve(data.data)
      }
    }
    worker.onerror = (event) => {
      if (worker !== currentWorker)
        return

      event.preventDefault()
      fail('Не удалось пересчитать трек. Повторите попытку.')
    }
    worker.onmessageerror = () => {
      if (worker === currentWorker)
        fail('Не удалось прочитать результат пересчёта трека.')
    }
  }

  return {
    cancel,
    process(base, corrections) {
      if (pending || (loadedBase && loadedBase !== base))
        cancel()

      return new Promise((resolve, reject) => {
        try {
          if (!worker)
            initialize()

          const id = ++sequence
          pending = {
            id,
            resolve,
            reject,
            timeout: setTimeout(fail, 120000, 'Пересчёт занял слишком много времени. Повторите попытку.'),
          }
          const request: PreviewRequest = {
            id,
            corrections: corrections.map(correction => ({ ...correction })),
          }

          if (loadedBase !== base)
            request.base = toRaw(base)

          worker!.postMessage(request)
          loadedBase = base
        }
        catch (error) {
          if (pending)
            clearTimeout(pending.timeout)

          pending = null
          cancel()
          reject(error instanceof Error
            ? error
            : new Error('Не удалось запустить фоновую обработку трека.'))
        }
      })
    },
  }
}
