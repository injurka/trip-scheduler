import type { IAiTripJobStatus } from '~/shared/services/api/model/types'
import { ref } from 'vue'
import { useRequest } from '~/plugins/request'

export type AiTripPhase = 'idle' | 'generating' | 'importing' | 'done' | 'error'

const PHASE_BY_STATUS: Record<IAiTripJobStatus['status'], AiTripPhase> = {
  pending: 'generating',
  generating: 'generating',
  importing: 'importing',
  done: 'done',
  error: 'error',
}

export const AI_TRIP_REQUEST_KEYS = {
  GENERATE: 'ai-trip:generate',
  STATUS: 'ai-trip:status',
}

export function useAiTripGeneration() {
  const phase = ref<AiTripPhase>('idle')
  const stage = ref('')
  const logs = ref<string[]>([])
  const createdTripId = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)

  let pollTimer: ReturnType<typeof setTimeout> | null = null

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function applyStatus(status: IAiTripJobStatus) {
    phase.value = PHASE_BY_STATUS[status.status]
    stage.value = status.stage
    logs.value = status.logs
    errorMessage.value = status.error
    createdTripId.value = status.tripId
  }

  async function poll(jobId: string) {
    stopPolling()
    const tick = async () => {
      const status = await useRequest<IAiTripJobStatus>({
        key: `${AI_TRIP_REQUEST_KEYS.STATUS}:${jobId}`,
        fn: db => db.aiTrips.getStatus(jobId),
      })

      if (!status) {
        phase.value = 'error'
        errorMessage.value = 'Не удалось получить статус генерации.'
        return
      }

      applyStatus(status)

      if (status.status === 'done' || status.status === 'error')
        return

      pollTimer = setTimeout(tick, 2500)
    }

    await tick()
  }

  async function start(input: { country: string, startDate: string, days: number, wishes?: string }) {
    stopPolling()
    phase.value = 'generating'
    stage.value = 'Отправка запроса…'
    logs.value = []
    createdTripId.value = null
    errorMessage.value = null

    const result = await useRequest<{ jobId: string }>({
      key: AI_TRIP_REQUEST_KEYS.GENERATE,
      fn: db => db.aiTrips.generate(input),
      onError: ({ error }) => {
        phase.value = 'error'
        errorMessage.value = error.customMessage
      },
    })

    if (!result)
      return

    await poll(result.jobId)
  }

  function reset() {
    stopPolling()
    phase.value = 'idle'
    stage.value = ''
    logs.value = []
    createdTripId.value = null
    errorMessage.value = null
  }

  return {
    phase,
    stage,
    logs,
    createdTripId,
    errorMessage,
    start,
    reset,
    stopPolling,
  }
}
