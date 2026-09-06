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

  const currentSegment = computed(() =>
    renderSegments.value.find(s => t.value >= s.t0 && t.value <= s.t1)
    ?? renderSegments.value[0],
  )

  const currentActivity = computed<ActivityType>(() => currentSegment.value?.activity || 'still')
  const currentActivityColor = computed(() => ACTIVITY_COLORS[currentActivity.value] || '#2196f3')
  const currentActivityIcon = computed(() => ACTIVITY_ICONS[currentActivity.value] || 'mdi:crosshairs-question')
  const currentActivityLabel = computed(() => ACTIVITY_LABELS[currentActivity.value] || 'Движение')

  const currentPoint = computed<DayData['points'][0] | null>(() => {
    const pts = dayData.value?.points
    if (!pts || pts.length === 0)
      return null

    let p = pts[0]
    for (const q of pts) {
      if (q.tsUtc <= t.value)
        p = q
      else break
    }
    return p
  })

  const speedKmhFromPoints = computed(() => {
    if (currentPoint.value?.speed != null && currentPoint.value.speed >= 0) {
      return currentPoint.value.speed * 3.6
    }
    const pts = dayData.value?.points
    if (!pts || pts.length < 2)
      return null
    let i = 0
    for (let j = 1; j < pts.length; j++) {
      if (pts[j].tsUtc <= t.value)
        i = j
    }
    const a = pts[Math.max(0, i - 1)]
    const b = pts[i]
    const dtH = (b.tsUtc - a.tsUtc) / 3_600_000
    if (dtH <= 0 || dtH > 0.25)
      return null
    const dM = haversineM(a.lat, a.lng, b.lat, b.lng)
    return dM / 1000 / dtH
  })

  function skipToNextMovement() {
    const pts = dayData.value?.points
    if (!pts || pts.length === 0)
      return

    // Ищем следующую точку с движением (скорость > 0.5 м/с или активность не still)
    const nextMoving = pts.find(p => p.tsUtc > t.value + 1000 && (p.activity !== 'still' || (p.speed != null && p.speed > 0.5)))
    if (nextMoving) {
      t.value = nextMoving.tsUtc
    }
    else {
      // Если после текущего времени движения нет, переходим в конец дня
      t.value = dayEnd.value
    }
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
    skipToNextMovement,
  }
}
