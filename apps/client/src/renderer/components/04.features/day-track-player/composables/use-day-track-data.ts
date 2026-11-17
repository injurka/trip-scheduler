import type { Ref } from 'vue'
import type { DayData, DayPoint, RenderSegment } from '../models/types'
import { useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCalendarDay } from '~/shared/composables/use-calendar-day'
import { AppRouteNames } from '~/shared/constants/routes'
import { trackingService } from '~/shared/services/database/tracking.service'
import { deleteStoredPoint } from '~/shared/services/tracking/geotrack-client'
import {
  prepareTrack,
} from '~/shared/services/tracking/track-processing'
import { trackingOwner } from '~/shared/services/tracking/tracking-owner'
import { loadTrackDay } from '../lib/load-track-day'
import { createTrackPreviewProcessor } from '../lib/track-preview-client'
import { detailedRouteSegments } from '../lib/track-route-geometry'

export interface UseDayTrackDataOptions {
  preview?: (data: DayData) => DayData
  canRefresh?: () => boolean
  beforeChange?: () => Promise<boolean>
  onRejectedChange?: () => void
  timeZone?: Ref<string | undefined>
  tripId?: Ref<string | undefined>
  dayUtcProp?: Ref<string | undefined>
  /**
   * Даты дней (YYYY-MM-DD), между которыми разрешено переключаться. Нужны, когда
   * плеер открыт внутри секции поездки: там «день» — это день плана, и выйти за
   * список нельзя, иначе карта покажет дату, которой в секции нет.
   * Пусто — свободная навигация по календарю (режим GPS-трекинга).
   */
  availableDays?: Ref<string[] | undefined>
}

export function useDayTrackData(options: UseDayTrackDataOptions = {}) {
  const route = useRoute()
  const router = useRouter()

  const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/
  function isValidDay(value: unknown): value is string {
    return typeof value === 'string' && DAY_REGEX.test(value)
  }

  const loadedDayData = ref<DayData | null>(null)
  const deviceTimeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const calendarTimeZone = () => options.tripId?.value ? loadedDayData.value?.timeZone ?? options.timeZone?.value ?? deviceTimeZone : options.timeZone?.value ?? deviceTimeZone
  const todayUtc = useCalendarDay(calendarTimeZone)
  const initialDay = options.dayUtcProp?.value || (route.query.day as string) || todayUtc.value
  // Защита от битой даты в данных («Invalid Date» и т.п.): в loadDay уходит только
  // валидный YYYY-MM-DD, иначе сервер режет по zod `/^\d{4}-\d{2}-\d{2}$/`.
  const selectedDay = ref(isValidDay(initialDay) ? initialDay : todayUtc.value)

  const isLoading = ref(true)
  const dayData = computed({
    get: () => loadedDayData.value && (options.preview?.(loadedDayData.value) ?? loadedDayData.value),
    set: (value: DayData | null) => {
      loadedDayData.value = value
    },
  })
  const loadError = ref<string | null>(null)
  const isDeletingPoint = ref(false)
  let loadSequence = 0
  let loadedKey: string | null = null
  let knownTripOwner: string | undefined
  const localProcessor = createTrackPreviewProcessor()
  onScopeDispose(() => {
    loadSequence++
    localProcessor.cancel()
  })

  const activeTripId = ref(options.tripId?.value)
  function requestDay(day: string) {
    const tripId = activeTripId.value
    const shareSlug = String(route.query.shareSlug ?? route.params.slug ?? route.params.id ?? '') || undefined

    return tripId
      ? trackingService.getTripDay(
          tripId,
          day,
          shareSlug,
          options.timeZone?.value,
        )
      : trackingService.getDay(day, options.timeZone?.value ?? deviceTimeZone)
  }

  function requestKey(targetDay: string) {
    return JSON.stringify([trackingOwner(), activeTripId.value, options.timeZone?.value, targetDay])
  }

  function acceptResponse(owner: string | null, data: DayData) {
    if (owner !== trackingOwner())
      return false

    if (data.ownerId)
      knownTripOwner = data.ownerId

    return true
  }
  function prepareResponse(res: DayData) {
    if (Array.isArray(res.points) && !res.preparedRenderSegments) {
      res.rawPoints = res.points
      const source = res.points.map((p: DayPoint) => ({ ...p, altitude: p.altitude ?? null, bearing: p.bearing ?? null, activityConfidence: p.activityConfidence ?? 0 }))
      res.points = prepareTrack(source)
    }
  }
  async function loadDay(targetDay: string) {
    if (!isValidDay(targetDay))
      return

    const key = requestKey(targetDay)
    const sequence = ++loadSequence
    isLoading.value = true
    loadError.value = null

    // Never leave another date or account visible while a request is in flight.
    if (loadedKey !== key)
      loadedDayData.value = null

    try {
      const owner = trackingOwner()
      const res = await loadTrackDay({
        request: () => requestDay(targetDay),
        day: targetDay,
        owner,
        tripId: activeTripId.value,
        knownTripOwner,
        timeZone: options.timeZone?.value,
        processor: localProcessor,
        isCurrent: () => owner === trackingOwner() && sequence === loadSequence,
      })

      if (sequence !== loadSequence)
        return

      if (!acceptResponse(owner, res))
        return

      prepareResponse(res)

      loadedKey = key
      dayData.value = res

      return true
    }
    catch (e) {
      if (sequence === loadSequence)
        loadError.value = e instanceof Error ? e.message : String(e)

      return false
    }
    finally {
      if (sequence === loadSequence)
        isLoading.value = false
    }
  }

  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let refreshQueued = false
  function scheduleRefresh() {
    refreshQueued = true

    if (refreshTimer || isLoading.value || options.canRefresh?.() === false)
      return

    refreshTimer = setTimeout(() => {
      refreshTimer = undefined

      if (isLoading.value || options.canRefresh?.() === false)
        return

      refreshQueued = false
      void loadDay(selectedDay.value)
    }, 5000)
  }
  useEventListener(window, 'tracking-queue-changed', scheduleRefresh)
  watch(() => [isLoading.value, options.canRefresh?.()], () => {
    if (refreshQueued)
      scheduleRefresh()
  })
  onScopeDispose(() => clearTimeout(refreshTimer))

  useEventListener(window, 'tracking-owner-changed', () => {
    void loadDay(selectedDay.value)
  })

  if (options.dayUtcProp) {
    watch(options.dayUtcProp, async (val) => {
      if (val && isValidDay(val) && val !== selectedDay.value) {
        if (options.beforeChange && !await options.beforeChange()) {
          options.onRejectedChange?.()

          return
        }

        selectedDay.value = val
      }
    })
  }

  watch(() => route.query.day, async (val) => {
    if (isValidDay(val) && val !== selectedDay.value) {
      if (options.beforeChange && !await options.beforeChange())
        return

      selectedDay.value = val
    }
  })

  if (options.tripId) {
    watch(options.tripId, async () => {
      if (options.beforeChange && !await options.beforeChange())
        return

      knownTripOwner = undefined
      activeTripId.value = options.tripId?.value
      dayData.value = null
      void loadDay(selectedDay.value)
    })
  }

  watch(selectedDay, (day) => {
    void loadDay(day)
  }, { immediate: true, flush: 'sync' })

  const availableDays = computed(() => options.availableDays?.value ?? [])

  /**
   * Индекс текущей даты в списке дней. Дата вне списка (например, трекинг открыт
   * на «сегодня», которого в поездке нет) — берём ближайший по календарю день.
   */
  function resolveDayIndex(): number {
    const list = availableDays.value
    const exact = list.indexOf(selectedDay.value)

    if (exact !== -1)
      return exact

    const current = new Date(`${selectedDay.value}T12:00:00Z`).getTime()
    let bestIndex = 0
    let bestDiff = Number.POSITIVE_INFINITY

    for (let i = 0; i < list.length; i++) {
      const diff = Math.abs(new Date(`${list[i]}T12:00:00Z`).getTime() - current)

      if (diff < bestDiff) {
        bestDiff = diff
        bestIndex = i
      }
    }

    return bestIndex
  }

  function applyDay(targetDay: string) {
    selectedDay.value = targetDay

    if (route.name === AppRouteNames.ActivityMap) {
      router.replace({ query: { ...route.query, day: targetDay } })
    }
  }

  function changeDay(offset: number) {
    const list = availableDays.value

    if (list.length > 0) {
      const next = list[resolveDayIndex() + offset]

      if (next)
        applyDay(next)

      return
    }

    const cur = new Date(`${selectedDay.value}T12:00:00Z`)
    cur.setUTCDate(cur.getUTCDate() + offset)
    const nextStr = cur.toISOString().slice(0, 10)

    if (nextStr > todayUtc.value)
      return

    applyDay(nextStr)
  }

  function goToToday() {
    const list = availableDays.value

    if (list.length > 0) {
      // «Сегодня» вне списка дней поездки — берём последний прошедший день поездки
      const past = list.filter(day => day <= todayUtc.value)
      applyDay(past.length > 0 ? past[past.length - 1] : list[0])

      return
    }

    applyDay(todayUtc.value)
  }

  function selectDay(targetDay: string) {
    const list = availableDays.value

    if (list.length > 0) {
      if (list.includes(targetDay))
        applyDay(targetDay)

      return
    }

    if (targetDay > todayUtc.value)
      return

    applyDay(targetDay)
  }

  function formatHeaderDay(dayStr: string): string {
    if (!isValidDay(dayStr))
      return dayStr || '—'

    const d = new Date(`${dayStr}T12:00:00Z`)

    return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
  }

  const renderSegments = computed<RenderSegment[]>(() => {
    const d = dayData.value

    if (!d)
      return []

    if (d.preparedRenderSegments)
      return d.preparedRenderSegments

    if (d.segments.length > 0) {
      return detailedRouteSegments(d)
    }

    // Fallback: группировка сырых точек по активности
    const out: RenderSegment[] = []
    let cur: RenderSegment | null = null

    for (const p of d.points) {
      if (cur && cur.activity === p.activity) {
        cur.points.push(p)
        cur.t1 = p.tsUtc
      }
      else {
        cur = { activity: p.activity, points: [p], t0: p.tsUtc, t1: p.tsUtc }
        out.push(cur)
      }
    }

    return out
  })

  const totalPointsCount = computed(() => dayData.value?.rawPoints?.length ?? dayData.value?.points.length ?? 0)

  const sortedPoints = computed(() => {
    const pts = dayData.value?.points || []

    return [...pts].sort((a, b) => a.tsUtc - b.tsUtc)
  })

  const displayPoints = computed(() => {
    return sortedPoints.value.filter((p, i, all) => !p.stop || i === 0 || p.stop !== all[i - 1].stop)
  })

  const displayPointsCount = computed(() => displayPoints.value.length)

  const dayStart = computed(() => {
    if (dayData.value?.points?.length) {
      return dayData.value.points[0].tsUtc
    }

    return renderSegments.value.length > 0
      ? Math.min(...renderSegments.value.map(s => s.t0))
      : 0
  })

  const dayEnd = computed(() => {
    if (dayData.value?.points?.length) {
      return dayData.value.points[dayData.value.points.length - 1].tsUtc
    }

    return renderSegments.value.length > 0
      ? Math.max(...renderSegments.value.map(s => s.t1))
      : 0
  })

  async function handleDeletePoint(pt: DayPoint, onDeleted?: () => void) {
    const data = dayData.value
    const tripId = options.tripId?.value

    if (!data || (tripId && !data.canEdit))
      return

    isDeletingPoint.value = true

    try {
      // 1. Запрос на сервер для удаления точки и нормализации сегментов сессии
      await trackingService.deletePoint(pt.clientPointId, tripId, data.timeZone)

      // 2. Удаляем из локальной очереди клиента (если еще не отправлена)
      if (!tripId)
        await deleteStoredPoint(pt.clientPointId)

      onDeleted?.()
      await loadDay(selectedDay.value)
    }
    catch (err) {
      loadError.value = err instanceof Error ? err.message : String(err)
    }
    finally {
      isDeletingPoint.value = false
    }
  }

  return {
    sourceDayData: loadedDayData,
    todayUtc,
    selectedDay,
    isLoading,
    dayData,
    loadError,
    isDeletingPoint,
    renderSegments,
    totalPointsCount,
    sortedPoints,
    displayPoints,
    displayPointsCount,
    dayStart,
    dayEnd,
    loadDay,
    changeDay,
    selectDay,
    goToToday,
    formatHeaderDay,
    handleDeletePoint,
  }
}
