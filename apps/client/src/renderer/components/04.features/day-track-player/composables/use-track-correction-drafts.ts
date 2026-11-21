import type { ActivityCorrection } from '@limiteddissolve/track-processing'
import type { TrackPreviewProcessor } from '../lib/track-preview-client'
import type { DayData } from '../models/types'
import { computed, getCurrentScope, markRaw, onScopeDispose, ref, shallowRef } from 'vue'
import { createTrackPreviewProcessor } from '../lib/track-preview-client'

export type CorrectionChoice = Omit<ActivityCorrection, 'id' | 'createdAt'> & { point?: boolean }

export function useTrackCorrectionDrafts(processor: TrackPreviewProcessor = createTrackPreviewProcessor()) {
  const additions = ref<Array<ActivityCorrection & { point?: boolean }>>([])
  const removals = ref<string[]>([])
  const attempted = new Set<string>()
  const count = computed(() => additions.value.length + removals.value.length)
  const processing = ref(false)
  const result = shallowRef<DayData | null>(null)
  let resultBase: DayData | null = null
  let generation = 0

  if (getCurrentScope())
    onScopeDispose(() => clear())

  async function commit(base: DayData | null, nextAdditions: typeof additions.value, nextRemovals: string[]) {
    if (processing.value)
      throw new Error('Дождитесь завершения пересчёта')

    if (!base)
      throw new Error('Дождитесь загрузки трека')

    const version = generation
    processing.value = true

    try {
      const corrections = [...(base.corrections ?? []).filter(c => !nextRemovals.includes(c.id)), ...nextAdditions]
      const next = nextAdditions.length + nextRemovals.length ? await processor.process(base, corrections) : base

      if (version !== generation)
        throw new Error('Пересчёт отменён')

      resultBase = base
      result.value = markRaw(next)
      additions.value = nextAdditions
      removals.value = nextRemovals
    }
    finally { processing.value = false }
  }
  async function stage(choice: CorrectionChoice, data: DayData | null) {
    const replaced = additions.value.filter(c => c.sessionId === choice.sessionId
      && c.startedAt === choice.startedAt && c.endedAt === choice.endedAt
      && (c.geometryAction ?? null) === (choice.geometryAction ?? null))
    const cleanup = replaced.filter(c => attempted.has(c.id) && !removals.value.includes(c.id)).map(c => c.id)
    const prior = additions.value.filter(c => !replaced.includes(c))

    if (prior.length + removals.value.length + cleanup.length >= 200)
      throw new Error('Примените текущий пакет: максимум 200 изменений.')

    const time = Math.max(Date.now(), ...[...(data?.corrections ?? []), ...additions.value].map(c => c.createdAt + 1))
    await commit(data, [...prior, { ...choice, id: crypto.randomUUID(), createdAt: time }], [...removals.value, ...cleanup])
  }
  async function remove(id: string, base: DayData | null) {
    const nextAdditions = additions.value.filter(c => c.id !== id)
    const nextRemovals = [...removals.value]
    const wasDraft = additions.value.some(c => c.id === id)

    if ((!wasDraft || attempted.has(id)) && !nextRemovals.includes(id))
      nextRemovals.push(id)

    if (nextAdditions.length + nextRemovals.length > 200)
      throw new Error('Примените текущий пакет: максимум 200 изменений.')

    await commit(base, nextAdditions, nextRemovals)
  }
  async function removeMany(ids: string[], base: DayData | null) {
    const selected = new Set(ids)
    const nextAdditions = additions.value.filter(c => !selected.has(c.id))
    const nextRemovals = [...new Set([...removals.value, ...ids.filter(id => !additions.value.some(c => c.id === id) || attempted.has(id))])]

    if (nextAdditions.length + nextRemovals.length > 200)
      throw new Error('Примените текущий пакет: максимум 200 изменений.')

    await commit(base, nextAdditions, nextRemovals)
  }
  function clear() {
    generation++
    processor.cancel()
    result.value = null
    resultBase = null
    additions.value = []
    removals.value = []
    attempted.clear()
  }
  function preview(base: DayData): DayData {
    const current = result.value

    return resultBase === base ? current ?? base : base
  }

  return {
    removeMany,
    processing,
    additions,
    removals,
    count,
    stage,
    remove,
    clear,
    preview,
    markSubmitted: () => additions.value.forEach(c => attempted.add(c.id)),
  }
}
