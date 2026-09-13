import type { ComputedRef, Ref } from 'vue'
import type { DayData, RenderSegment } from '../models/types'
import type { ActivityType } from '~/shared/services/tracking/track-processing'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { haversineM } from '~/shared/services/tracking/track-processing'
import {
  ACTIVITY_COLORS,
  ACTIVITY_ICONS,
  ACTIVITY_LABELS,
  SPEED_BASE,
} from '../models/types'

export interface UseDayTrackPlaybackOptions {
  selectedDay: Ref<string>
  dayStart: ComputedRef<number>
  dayEnd: ComputedRef<number>
  dayData: Ref<DayData | null>
  renderSegments: ComputedRef<RenderSegment[]>
}

export function useDayTrackPlayback(options: UseDayTrackPlaybackOptions) {
  const { selectedDay, dayStart, dayEnd, dayData, renderSegments } = options

  const t = ref(0)
  const isPlaying = ref(false)
  const speedMultiplier = ref<number>(2)
  const isFollowCamera = ref(true)

  let raf = 0
  let lastTs = 0

  function tick(ts: number) {
    if (lastTs !== 0) {
      const delta = (ts - lastTs) * SPEED_BASE * speedMultiplier.value
      t.value = Math.min(t.value + delta, dayEnd.value)
      if (t.value >= dayEnd.value)
        isPlaying.value = false
    }
    lastTs = ts
    if (isPlaying.value)
      raf = requestAnimationFrame(tick)
  }

  watch(isPlaying, (playing) => {
    lastTs = 0
    if (playing) {
      if (t.value >= dayEnd.value)
        t.value = dayStart.value
      raf = requestAnimationFrame(tick)
    }
    else {
      cancelAnimationFrame(raf)
    }
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
  })

  watch(selectedDay, () => {
    t.value = 0
    isPlaying.value = false
  })

  watch(dayStart, (v) => {
    if (t.value === 0 && v > 0)
      t.value = v
  })

  function resetPlayback() {
    t.value = 0
    isPlaying.value = false
  }

  function stepSeconds(deltaSec: number) {
    t.value = Math.max(dayStart.value, Math.min(dayEnd.value, t.value + deltaSec * 1000))
  }

  function findPointIndexByTime(pts: DayData['points'], targetT: number): number {
    let low = 0
    let high = pts.length - 1
    let ans = 0
    while (low <= high) {
      const mid = (low + high) >> 1
      if (pts[mid].tsUtc <= targetT) {
        ans = mid
        low = mid + 1
      }
      else {
        high = mid - 1
      }
    }
    return ans
  }

  const currentSegment = computed(() =>
    renderSegments.value.find(s => t.value >= s.t0 && t.value <= s.t1),
  )

  const currentPointIndex = computed(() => {
    const pts = dayData.value?.points
    if (!pts || pts.length === 0)
      return -1
    return findPointIndexByTime(pts, t.value)
  })

  const currentPoint = computed<DayData['points'][0] | null>(() => {
    const pts = dayData.value?.points
    if (!pts || pts.length === 0)
      return null

    const idx = currentPointIndex.value
    if (idx < 0)
      return null

    const p = pts[idx]
    const next = idx < pts.length - 1 ? pts[idx + 1] : undefined

    if (p.stop && t.value <= p.stop.endedAt)
      return p
    if (!next || next.sessionId !== p.sessionId || next.tsUtc - p.tsUtc > 900_000)
      return { ...p, stop: undefined, speed: null, activity: 'unknown' }
    const fraction = Math.max(0, Math.min(1, (t.value - p.tsUtc) / (next.tsUtc - p.tsUtc)))
    return { ...p, lat: p.lat + (next.lat - p.lat) * fraction, lng: p.lng + (next.lng - p.lng) * fraction, stop: undefined }
  })

  const currentActivity = computed<ActivityType>(() => currentPoint.value?.stop ? 'still' : currentSegment.value?.activity || 'unknown')
  const currentActivityColor = computed(() => ACTIVITY_COLORS[currentActivity.value] || '#2196f3')
  const currentActivityIcon = computed(() => ACTIVITY_ICONS[currentActivity.value] || 'mdi:crosshairs-question')
  const currentActivityLabel = computed(() => ACTIVITY_LABELS[currentActivity.value] || 'Движение')

  const speedKmhFromPoints = computed(() => {
    if (currentPoint.value?.stop)
      return 0
    if (currentPoint.value?.speed != null && currentPoint.value.speed >= 0) {
      return currentPoint.value.speed * 3.6
    }
    const pts = dayData.value?.points
    if (!pts || pts.length < 2)
      return null
    const i = currentPointIndex.value
    if (i < 0)
      return null
    const a = pts[Math.max(0, i - 1)]
    const b = pts[i]
    const dtH = (b.tsUtc - a.tsUtc) / 3_600_000
    if (dtH <= 0 || dtH > 0.25)
      return null
    const dM = haversineM(a.lat, a.lng, b.lat, b.lng)
    return dM / 1000 / dtH
  })

  function skipToPrevMovement() {
    const pts = dayData.value?.points
    if (!pts || pts.length === 0)
      return

    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i]
      if (p.tsUtc < t.value - 2000 && (p.activity !== 'still' || (p.speed != null && p.speed > 0.5))) {
        t.value = p.tsUtc
        return
      }
    }
    t.value = dayStart.value
  }

  function skipToNextMovement() {
    const pts = dayData.value?.points
    if (!pts || pts.length === 0)
      return

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      if (p.tsUtc > t.value + 2000 && (p.activity !== 'still' || (p.speed != null && p.speed > 0.5))) {
        t.value = p.tsUtc
        return
      }
    }
    t.value = dayEnd.value
  }

  return {
    t,
    isPlaying,
    speedMultiplier,
    isFollowCamera,
    currentSegment,
    currentActivity,
    currentActivityColor,
    currentActivityIcon,
    currentActivityLabel,
    currentPoint,
    speedKmhFromPoints,
    resetPlayback,
    stepSeconds,
    skipToPrevMovement,
    skipToNextMovement,
  }
}
