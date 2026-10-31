import type {
  IAiTripConceptProposal,
  IAiTripJobStatus,
  IGenerateAiTripInput,
  IProposeAiTripConceptInput,
} from '~/shared/services/api/model/types'
import { ref } from 'vue'
import { useRequest } from '~/plugins/request'

export type AiTripPhase = 'idle' | 'proposing' | 'review' | 'generating' | 'importing' | 'done' | 'error'

const PHASE_BY_STATUS: Record<IAiTripJobStatus['status'], AiTripPhase> = {
  pending: 'generating',
  generating: 'generating',
  importing: 'importing',
  done: 'done',
  needs_input: 'error',
  error: 'error',
}

export const AI_TRIP_REQUEST_KEYS = {
  PROPOSE: 'ai-trip:propose-concept',
  GENERATE: 'ai-trip:generate',
  STATUS: 'ai-trip:status',
}

export function useAiTripGeneration() {
  const phase = ref<AiTripPhase>('idle')
  const stage = ref('')
  const logs = ref<string[]>([])
  const createdTripId = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)
  const progress = ref<number | null>(null)
  const attempt = ref(0)
  const attemptsTotal = ref(1)
  const concept = ref<IAiTripConceptProposal | null>(null)
  const isRefining = ref(false)
  const refineError = ref<string | null>(null)

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
    progress.value = status.progress ?? null
    attempt.value = status.attempt
    attemptsTotal.value = status.attemptsTotal || 1
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

      if (status.status === 'done' || status.status === 'needs_input' || status.status === 'error')
        return

      pollTimer = setTimeout(tick, 2500)
    }

    await tick()
  }

  async function propose(input: IProposeAiTripConceptInput): Promise<IAiTripConceptProposal | null> {
    stopPolling()
    phase.value = 'proposing'
    stage.value = 'ИИ подбирает города, места, отели и план по дням…'
    errorMessage.value = null
    refineError.value = null

    const result = await useRequest<IAiTripConceptProposal>({
      key: AI_TRIP_REQUEST_KEYS.PROPOSE,
      force: true,
      fn: db => db.aiTrips.proposeConcept(input),
      onError: ({ error }) => {
        phase.value = 'error'
        errorMessage.value = error.customMessage || 'Не удалось составить концепцию маршрута.'
      },
    })

    if (!result)
      return null

    concept.value = result
    phase.value = 'review'
    stage.value = ''

    return result
  }

  async function refineConcept(input: IProposeAiTripConceptInput): Promise<IAiTripConceptProposal | null> {
    isRefining.value = true
    refineError.value = null

    const result = await useRequest<IAiTripConceptProposal>({
      key: `${AI_TRIP_REQUEST_KEYS.PROPOSE}:refine`,
      force: true,
      fn: db => db.aiTrips.proposeConcept(input),
      onError: ({ error }) => {
        refineError.value = error.customMessage || 'Не удалось обновить концепцию.'
      },
    })

    isRefining.value = false

    if (!result)
      return null

    concept.value = result

    return result
  }

  async function start(input: IGenerateAiTripInput) {
    stopPolling()
    phase.value = 'generating'
    stage.value = 'Отправка запроса…'
    logs.value = []
    createdTripId.value = null
    errorMessage.value = null
    progress.value = 4
    attempt.value = 1
    attemptsTotal.value = 3

    const result = await useRequest<{ jobId: string }>({
      key: AI_TRIP_REQUEST_KEYS.GENERATE,
      force: true,
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

  function backToForm() {
    stopPolling()
    phase.value = 'idle'
    errorMessage.value = null
    refineError.value = null
  }

  function backFromError() {
    stopPolling()
    errorMessage.value = null
    phase.value = concept.value ? 'review' : 'idle'
  }

  function reset() {
    stopPolling()
    phase.value = 'idle'
    stage.value = ''
    logs.value = []
    createdTripId.value = null
    errorMessage.value = null
    progress.value = null
    attempt.value = 0
    attemptsTotal.value = 1
    concept.value = null
    isRefining.value = false
    refineError.value = null
  }

  return {
    phase,
    stage,
    logs,
    createdTripId,
    errorMessage,
    progress,
    attempt,
    attemptsTotal,
    concept,
    isRefining,
    refineError,
    propose,
    refineConcept,
    start,
    backToForm,
    backFromError,
    reset,
    stopPolling,
  }
}
