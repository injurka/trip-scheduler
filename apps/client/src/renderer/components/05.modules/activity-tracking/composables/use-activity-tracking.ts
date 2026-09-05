import type { DaySummary } from '../models/types'
import { useRouter } from 'vue-router'
import { AppRouteNames } from '~/shared/constants/routes'
import { trpc } from '~/shared/services/trpc/trpc.service'

export function useActivityTracking() {
  const router = useRouter()

  const selectedDays = ref<number>(14)
  const isLoading = ref<boolean>(true)
  const isRefreshing = ref<boolean>(false)
  const loadError = ref<string | null>(null)
  const summaries = ref<DaySummary[]>([])

  const todayUtc = computed(() => new Date().toISOString().slice(0, 10))

  const overallDistanceM = computed(() =>
    summaries.value.reduce((sum, s) => sum + s.totalDistanceM, 0),
  )

  const overallDurationMs = computed(() =>
    summaries.value.reduce((sum, s) => sum + s.totalDurationMs, 0),
  )

  const activeDaysCount = computed(() =>
    summaries.value.filter(s => s.hasData && s.totalDistanceM > 0).length,
  )

  const recordedDays = computed(() =>
    summaries.value.filter(s => s.hasData),
  )

  const hasAnyData = computed(() =>
    recordedDays.value.length > 0,
  )

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

    try {
      const res = await (trpc as any).tracking.getSummaries.query({ days: selectedDays.value })
      if (reqId !== activeRequestId)
        return
      summaries.value = res.summaries
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
    await loadSummaries({ isSilent: summaries.value.length > 0 })
  }

  function isToday(dayUtc: string): boolean {
    return dayUtc === todayUtc.value
  }

  function formatDay(dayUtc: string): string {
    if (isToday(dayUtc))
      return 'Сегодня'
    const d = new Date(`${dayUtc}T12:00:00Z`)
    return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
  }

  function formatDistance(m: number): string {
    if (m < 1000)
      return `${Math.round(m)} м`
    return `${(m / 1000).toFixed(1)} км`
  }

  function formatDuration(ms: number): string {
    const min = Math.round(ms / 60_000)
    if (min < 60)
      return `${min} мин`
    const h = Math.floor(min / 60)
    return `${h} ч ${min % 60} мин`
  }

  function formatTime(ts: number | null): string {
    if (!ts)
      return '--:--'
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  }

  function openDayOnMap(dayUtc: string) {
    router.push({
      name: AppRouteNames.ActivityMap,
      query: { view: 'memories', day: dayUtc },
    })
  }

  /** Вход в просмотрщик «Воспоминания дня» без привязки к конкретному дню */
  function openMemories() {
    router.push({
      name: AppRouteNames.ActivityMap,
      query: { view: 'memories' },
    })
  }

  onMounted(() => {
    void loadSummaries()
  })

  return {
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
    loadSummaries,
    refresh,
    setDaysRange,
    isToday,
    formatDay,
    formatDistance,
    formatDuration,
    formatTime,
    openDayOnMap,
    openMemories,
  }
}
