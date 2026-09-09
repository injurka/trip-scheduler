import type { Ref } from 'vue'
import type { DayData, DayPoint, RenderSegment } from '../models/types'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppRouteNames } from '~/shared/constants/routes'
import { deleteStoredPoint } from '~/shared/services/tracking/geotrack-client'
import {
  filterGpsOutliers,
  mergeStationaryPoints,
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

  async function loadDay(targetDay: string) {
    isLoading.value = true
    loadError.value = null
    try {
      const res = await (trpc as any).tracking.getDay.query({ dayUtc: targetDay })
      if (res && Array.isArray(res.points)) {
        res.points = filterGpsOutliers(res.points)
      }
      dayData.value = res
    }
    catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
    finally {
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
        points: s.geometry.map(([lng, lat], i) => ({
          tsUtc: s.startedAt + (i / Math.max(1, s.geometry.length - 1)) * (s.endedAt - s.startedAt),
          lat,
          lng,
        })),
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

  const totalPointsCount = computed(() => dayData.value?.points.length ?? 0)

  const sortedPoints = computed(() => {
    const pts = dayData.value?.points || []
    return [...pts].sort((a, b) => a.tsUtc - b.tsUtc)
  })

  const displayPoints = computed(() => {
    return mergeStationaryPoints(sortedPoints.value, { maxDistanceM: 5.0 })
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

      // 3. Удаляем из текущего массива точек
      dayData.value.points = dayData.value.points.filter(p => p.clientPointId !== pt.clientPointId)

      // 4. Мгновенная нормализация сегментов на клиенте из оставшихся точек
      const remaining = dayData.value.points
      if (remaining.length >= 2) {
        const processed = processDayTrack(remaining.map(p => ({
          clientPointId: p.clientPointId,
          tsUtc: p.tsUtc,
          lat: p.lat,
          lng: p.lng,
          altitude: p.altitude ?? null,
          accuracy: p.accuracy,
          speed: p.speed,
          bearing: p.bearing ?? null,
          activity: p.activity,
          activityConfidence: 85,
          sessionId: p.sessionId,
        })))
        dayData.value.segments = processed.map((s, idx) => ({
          id: `client-seg-${idx}`,
          sessionId: s.points[0]?.sessionId || '',
          activity: s.activity,
          confidence: s.confidence,
          startedAt: s.points[0].tsUtc,
          endedAt: s.points[s.points.length - 1].tsUtc,
          distanceM: s.features.distanceM,
          pointCount: s.points.length,
          geometry: s.points.map(p => [p.lng, p.lat] as [number, number]),
        }))
      }
      else {
        dayData.value.segments = []
      }

      onDeleted?.()
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
