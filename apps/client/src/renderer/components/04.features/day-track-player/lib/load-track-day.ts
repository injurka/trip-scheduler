import type { DayData, DayPoint } from '../models/types'
import type { TrackPreviewProcessor } from './track-preview-client'
import { calendarDayBounds } from '@limiteddissolve/track-processing'
import { geotrack } from '~/shared/services/tracking/geotrack-client'
import { originalTrackView } from './track-export'

interface LoadTrackDayOptions {
  request: () => Promise<DayData>
  day: string
  owner: string | null
  tripId?: string
  knownTripOwner?: string
  timeZone?: string
  processor: TrackPreviewProcessor
  isCurrent: () => boolean
}
async function fetchDay(options: LoadTrackDayOptions) {
  try {
    return { data: await options.request(), error: undefined }
  }
  catch (error) {
    return {
      data: {
        points: [],
        segments: [],
        timeZone:
          options.timeZone
          ?? new Intl.DateTimeFormat().resolvedOptions().timeZone,
      } as DayData,
      error,
    }
  }
}
async function appendLocalPoints(data: DayData, options: LoadTrackDayOptions) {
  const bounds = calendarDayBounds(options.day, data.timeZone ?? new Intl.DateTimeFormat().resolvedOptions().timeZone)
  const local = await geotrack.localPoints(bounds.from.getTime(), bounds.to.getTime())

  if (!options.isCurrent())
    return

  const serverIds = new Set(data.points.map(point => point.clientPointId))
  const pending = local.filter(point => !serverIds.has(point.clientPointId))
  data.localPendingCount = pending.length

  if (!pending.length)
    return

  const merged: DayPoint[] = [...data.points, ...pending].sort((a, b) => a.tsUtc - b.tsUtc)

  try {
    const processed = await options.processor.process({ ...data, points: merged, rawPoints: merged }, data.corrections ?? [])
    Object.assign(data, processed)
  }
  catch (error) {
    Object.assign(data, originalTrackView({ ...data, points: merged, rawPoints: merged }))
    data.localError = `Показаны исходные GPS-точки: ${error instanceof Error ? error.message : 'Не удалось обработать трек'}`
  }
}
function canReadLocal(options: LoadTrackDayOptions, data: DayData) {
  const ownTrip = !options.tripId || (data.ownerId ?? options.knownTripOwner) === options.owner

  return options.owner && ownTrip && geotrack?.localPoints
}
export async function loadTrackDay(options: LoadTrackDayOptions): Promise<DayData> {
  const response = await fetchDay(options)
  const data = { ...response.data }

  if (canReadLocal(options, data)) {
    try {
      await appendLocalPoints(data, options)
    }
    catch (error) {
      data.localError
        = error instanceof Error
          ? error.message
          : 'Не удалось прочитать локальные GPS-точки'
    }
  }

  if (response.error && !data.localPendingCount)
    throw response.error

  if (response.error) {
    data.localError
      = 'Сервер недоступен. Показаны только сохранённые на устройстве точки.'
  }

  return data
}
