import type { ComputedRef, Ref } from 'vue'
import type { DayData, DayPoint, TimezoneMode } from '../models/types'
import tzLookup from 'tz-lookup'
import { computed, ref } from 'vue'

export interface UseDayTrackTimezoneOptions {
  currentPoint: ComputedRef<DayPoint | null>
  dayData: Ref<DayData | null>
  t: Ref<number>
}

function lookupTimezone(lat: number | null | undefined, lng: number | null | undefined): string | undefined {
  if (lat == null || lng == null)
    return undefined

  try {
    return tzLookup(lat, lng)
  }
  catch {
    return undefined
  }
}

export function useDayTrackTimezone(options: UseDayTrackTimezoneOptions) {
  const { currentPoint, dayData, t } = options

  const timezoneMode = ref<TimezoneMode>('track')
  const deviceTimezone = new Intl.DateTimeFormat().resolvedOptions().timeZone

  const trackTimezone = computed<string | undefined>(() => {
    const pointTimezone = lookupTimezone(currentPoint.value?.lat, currentPoint.value?.lng)

    if (pointTimezone)
      return pointTimezone

    const firstPt = dayData.value?.points?.[0]

    return lookupTimezone(firstPt?.lat, firstPt?.lng)
  })

  function toggleTimezone() {
    timezoneMode.value = timezoneMode.value === 'track' ? 'device' : 'track'
  }

  function getTimezoneForPoint(pt?: { lat: number, lng: number } | null): string | undefined {
    if (timezoneMode.value === 'device') {
      return undefined
    }

    if (pt?.lat != null && pt?.lng != null) {
      const pointTimezone = lookupTimezone(pt.lat, pt.lng)

      if (pointTimezone)
        return pointTimezone
    }

    return trackTimezone.value
  }

  function formatPointTime(tsUtc: number, pt?: { lat: number, lng: number } | null): string {
    const tz = getTimezoneForPoint(pt)

    return new Date(tsUtc).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...(tz ? { timeZone: tz } : {}),
    })
  }

  const timeLabel = computed(() => {
    if (t.value <= 0)
      return '--:--'

    const tz = getTimezoneForPoint(currentPoint.value)

    return new Date(t.value).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...(tz ? { timeZone: tz } : {}),
    })
  })

  function fmtRange(ms: number) {
    if (ms <= 0)
      return '--:--'

    const tz = timezoneMode.value === 'track' ? trackTimezone.value : undefined

    return new Date(ms).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      ...(tz ? { timeZone: tz } : {}),
    })
  }

  return {
    timezoneMode,
    deviceTimezone,
    trackTimezone,
    toggleTimezone,
    getTimezoneForPoint,
    formatPointTime,
    timeLabel,
    fmtRange,
  }
}
