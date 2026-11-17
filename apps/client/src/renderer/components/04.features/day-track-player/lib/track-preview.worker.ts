import type { ActivityCorrection } from '@limiteddissolve/track-processing'
import type { DayData } from '../models/types'
import { createTrackPreviewTask } from './track-preview-task'

export interface PreviewRequest {
  id: number
  base?: DayData
  corrections: ActivityCorrection[]
}
export type PreviewResponse
  = | { id: number, data: DayData }
    | { id: number, error: string }
const context = globalThis as unknown as {
  onmessage: (event: MessageEvent<PreviewRequest>) => void
  postMessage: (response: PreviewResponse) => void
}
const task = createTrackPreviewTask()
context.onmessage = ({ data }) => {
  try {
    if (data.base)
      task.initialize(data.base)

    context.postMessage({
      id: data.id,
      data: task.calculate(data.corrections),
    })
  }
  catch (error) {
    context.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
