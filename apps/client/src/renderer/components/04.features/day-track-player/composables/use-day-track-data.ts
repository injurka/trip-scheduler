import type { Ref } from 'vue'
import type { DayData, DayPoint, RenderSegment } from '../models/types'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppRouteNames } from '~/shared/constants/routes'
import { deleteStoredPoint } from '~/shared/services/tracking/geotrack-client'
import {
  prepareTrack,
  processDayTrack,
} from '~/shared/services/tracking/track-processing'
import { trpc } from '~/shared/services/trpc/trpc.service'

export interface UseDayTrackDataOptions {
  dayUtcProp?: Ref<string | undefined>
}

export function useDayTrackData(options: UseDayTrackDataOptions = {}) {
  const route = useRoute()
  const router = useRouter()

  const todayUtc = new Date().toISOString().slice(0, 10)
  const selectedDay = ref(options.dayUtcProp?.value || (route.query.day as string) || todayUtc)

  const isLoading = ref(true)
  const dayData = ref<DayData | null>(null)
  const loadError = ref<string | null>(null)
  const isDeletingPoint = ref(false)
  let loadSequence = 0

  async function loadDay(targetDay: string) {
    const sequence = ++loadSequence
    isLoading.value = true
    loadError.value = null
    try {
      const res = await (trpc as any).tracking.getDay.query({ dayUtc: targetDay })
      if (sequence !== loadSequence)
        return
      if (res && Array.isArray(res.points)) {
        res.rawPoints = res.points
        const source = res.points.map((p: DayPoint) => ({ ...p, altitude: p.altitude ?? null, bearing: p.bearing ?? null, activityConfidence: 0 }))
        res.points = prepareTrack(source)
        res.segments = processDayTrack(source).map((s, i) => ({
          id: `processed-${i}`,
          sessionId: s.points[0].sessionId,
          activity: s.activity,
          confidence: s.confidence,
          startedAt: s.points[0].tsUtc,
          endedAt: s.points[s.points.length - 1].tsUtc,
          distanceM: s.features.distanceM,
          pointCount: s.points.length,
          geometry: s.points.map(p => [p.lng, p.lat]),
        }))
      }
      dayData.value = res
    }
    catch (e) {
      if (sequence === loadSequence)
        loadError.value = e instanceof Error ? e.message : String(e)
    }
    finally {
      if (sequence === loadSequence)
        isLoading.value = false
    }
  }

  if (options.dayUtcProp) {
    watch(
      options.dayUtcProp,
      (val) => {
        if (val && val !== selectedDay.value) {
          selectedDay.value = val
        }
      },
    )
  }

  watch(
    () => route.query.day,
    (val) => {
      if (typeof val === 'string' && val !== selectedDay.value) {
        selectedDay.value = val
      }
    },
  )

  watch(
    selectedDay,
    (day) => {
      void loadDay(day)
    },
    { immediate: true },
  )

  function changeDay(offset: number) {
    const cur = new Date(`${selectedDay.value}T12:00:00Z`)
    cur.setUTCDate(cur.getUTCDate() + offset)
    const nextStr = cur.toISOString().slice(0, 10)
    if (nextStr > todayUtc)
      return
    selectedDay.value = nextStr
    if (route.name === AppRouteNames.ActivityMap) {
      router.replace({ query: { ...route.query, day: nextStr } })
    }
  }

  function goToToday() {
    selectedDay.value = todayUtc
    if (route.name === AppRouteNames.ActivityMap) {
      router.replace({ query: { ...route.query, day: todayUtc } })
    }
  }

  function formatHeaderDay(dayStr: string): string {
    if (dayStr === todayUtc)
      return 'Сегодня'
    const d = new Date(`${dayStr}T12:00:00Z`)
    return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
  }

  const renderSegments = computed<RenderSegment[]>(() => {
    const d = dayData.value
    if (!d)
      return []
    if (d.segments.length > 0) {
      return d.segments.map(s => ({
        activity: s.activity,
        points: d.points.filter(p => p.sessionId === s.sessionId && p.tsUtc >= s.startedAt && p.tsUtc <= s.endedAt),
        t0: s.startedAt,
        t1: s.endedAt,
      }))
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
    if (!dayData.value)
      return
    isDeletingPoint.value = true
    try {
      // 1. Запрос на сервер для удаления точки и нормализации сегментов сессии
      await (trpc as any).tracking.deletePoint.mutate({ clientPointId: pt.clientPointId })

      // 2. Удаляем из локальной очереди клиента (если еще не отправлена)
      deleteStoredPoint(pt.clientPointId)

      onDeleted?.()
      await loadDay(selectedDay.value)
    }
    catch (err) {
      console.error('Ошибка удаления точки:', err)
    }
    finally {
      isDeletingPoint.value = false
    }
  }

  return {
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
    goToToday,
    formatHeaderDay,
    handleDeletePoint,
  }
}
