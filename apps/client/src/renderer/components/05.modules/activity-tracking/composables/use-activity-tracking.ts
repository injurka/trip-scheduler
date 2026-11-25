import type { DaySummary } from '../models/types'
import { useEventListener } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { formatActivityDay, formatActivityDistance, formatActivityDuration, formatActivityTime } from '~/components/03.domain/activity-day-summary/format'
import { useCalendarDay } from '~/shared/composables/use-calendar-day'
import { trackingOwner, trackingStorageKey } from '~/shared/services/tracking/tracking-owner'
import { trpc } from '~/shared/services/trpc/trpc.service'

const SUMMARIES_CACHE_PREFIX = 'tripscheduler_activity_summaries'
const memorySummariesCache = new Map<string, DaySummary[]>()

function readCachedSummaries(owner: string | null, days: number, timeZone: string): DaySummary[] | null {
  if (!owner)
    return null

  const key = `${trackingStorageKey(SUMMARIES_CACHE_PREFIX, owner)}:${timeZone}:${days}`
  const inMemory = memorySummariesCache.get(key)

  if (inMemory)
    return inMemory

  try {
    const raw = localStorage.getItem(key)

    if (!raw)
      return null

    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed)) {
      memorySummariesCache.set(key, parsed)

      return parsed as DaySummary[]
    }
  }
  catch {
    // ignore storage errors
  }

  return null
}

function writeCachedSummaries(
  owner: string | null,
  days: number,
  timeZone: string,
  items: DaySummary[],
) {
  if (!owner)
    return

  const key = `${trackingStorageKey(SUMMARIES_CACHE_PREFIX, owner)}:${timeZone}:${days}`
  memorySummariesCache.set(key, items)

  try {
    localStorage.setItem(key, JSON.stringify(items))
  }
  catch {
    // ignore quota errors
  }
}

export function useActivityTracking() {
  const selectedDays = ref<number>(14)
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const todayUtc = useCalendarDay(timeZone)

  const initialCached = readCachedSummaries(trackingOwner(), selectedDays.value, timeZone)
  const isLoading = ref<boolean>(initialCached === null)
  const isRefreshing = ref<boolean>(false)
  const loadError = ref<string | null>(null)
  const summaries = ref<DaySummary[]>(initialCached ?? [])

  const overallDistanceM = computed(() =>
    summaries.value.reduce((sum, s) => sum + s.totalDistanceM, 0))

  const overallDurationMs = computed(() =>
    summaries.value.reduce((sum, s) => sum + s.totalDurationMs, 0))

  const activeDaysCount = computed(() =>
    summaries.value.filter(s => s.hasData && s.totalDistanceM > 0).length)

  const recordedDays = computed(() =>
    summaries.value.filter(s => s.hasData))

  const hasAnyData = computed(() =>
    recordedDays.value.length > 0)

  let activeRequestId = 0

  async function loadSummaries(options: { isSilent?: boolean } = {}) {
    // Скелетон показываем только при первичном получении данных,
    // чтобы переключение фильтра дней не ломало верстку и не дергало скролл
    if (!options.isSilent && summaries.value.length === 0) {
      isLoading.value = true
    }
    else {
      isRefreshing.value = true
    }

    loadError.value = null
    const reqId = ++activeRequestId
    const owner = trackingOwner()
    const requestedDays = selectedDays.value

    try {
      const res = await (trpc).tracking.getSummaries.query({ days: requestedDays, timeZone })

      if (reqId !== activeRequestId || owner !== trackingOwner())
        return

      summaries.value = res.summaries
      writeCachedSummaries(
        owner,
        requestedDays,
        timeZone,
        res.summaries,
      )
    }
    catch (e) {
      if (reqId !== activeRequestId)
        return

      loadError.value = e instanceof Error ? e.message : String(e)
    }
    finally {
      if (reqId === activeRequestId) {
        isLoading.value = false
        isRefreshing.value = false
      }
    }
  }

  async function refresh() {
    await loadSummaries({ isSilent: false })
  }

  async function setDaysRange(days: number) {
    if (selectedDays.value === days)
      return

    selectedDays.value = days
    const cached = readCachedSummaries(trackingOwner(), days, timeZone)

    if (cached)
      summaries.value = cached

    await loadSummaries({ isSilent: summaries.value.length > 0 })
  }

  function isToday(dayUtc: string): boolean {
    return dayUtc === todayUtc.value
  }

  const isPlayerOpen = ref(false)
  const playerDayUtc = ref<string>(todayUtc.value)

  function openDayOnMap(dayUtc: string) {
    playerDayUtc.value = dayUtc
    isPlayerOpen.value = true
  }

  /** Вход в просмотрщик «Воспоминания дня» без привязки к конкретному дню */
  function openMemories() {
    playerDayUtc.value = todayUtc.value
    isPlayerOpen.value = true
  }

  function closePlayer() {
    isPlayerOpen.value = false
  }

  useEventListener(window, 'tracking-owner-changed', () => {
    const cached = readCachedSummaries(trackingOwner(), selectedDays.value, timeZone)
    summaries.value = cached ?? []
    isLoading.value = cached === null
    void loadSummaries()
  })

  onMounted(() => {
    void loadSummaries({ isSilent: summaries.value.length > 0 })
  })

  return {
    timeZone,
    selectedDays,
    isLoading,
    isRefreshing,
    loadError,
    summaries,
    overallDistanceM,
    overallDurationMs,
    activeDaysCount,
    recordedDays,
    hasAnyData,
    todayUtc,
    isPlayerOpen,
    playerDayUtc,
    loadSummaries,
    refresh,
    setDaysRange,
    isToday,
    formatDay: (dayUtc: string) => formatActivityDay(dayUtc, isToday(dayUtc)),
    formatDistance: formatActivityDistance,
    formatDuration: formatActivityDuration,
    formatTime: (ts: number | null) => formatActivityTime(ts, timeZone),
    openDayOnMap,
    openMemories,
    closePlayer,
  }
}
