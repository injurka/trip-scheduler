import type { DayPoint } from '../models/types'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '~/shared/lib/env'

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, char =>
    ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      '\'': '&apos;',
    })[char]!)
}
/** Raw fixes and edited labels have separate tracks; gaps and sessions have separate legs. */
export function exportTrackGpx(day: string, raw: DayPoint[], processed: DayPoint[]): string {
  function track(name: string, points: DayPoint[]) {
    const legs: DayPoint[][] = []

    for (const p of [...points].sort((a, b) => a.tsUtc - b.tsUtc)) {
      const last = legs.at(-1)?.at(-1)

      if (
        !last
        || last.sessionId !== p.sessionId
        || p.tsUtc - last.tsUtc > 30_000
      ) {
        legs.push([])
      }

      legs.at(-1)!.push(p)
    }

    return `<trk><name>${escapeXml(name)}</name>${legs.map(leg => `<trkseg>${leg.map(p => `<trkpt lat="${p.lat}" lon="${p.lng}">${p.altitude != null ? `<ele>${p.altitude}</ele>` : ''}<time>${new Date(p.tsUtc).toISOString()}</time><type>${escapeXml(p.activity)}</type></trkpt>`).join('')}</trkseg>`).join('')}</trk>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="TripScheduler" xmlns="http://www.topografix.com/GPX/1/1">${track(`${day} · Исходные GPS-точки`, raw.map(p => ({ ...p, activity: p.recordedActivity ?? p.activity })))}${track(`${day} · Обработанный трек`, processed)}</gpx>`
}
export async function saveTrackGpx(day: string, raw: DayPoint[], processed: DayPoint[]) {
  const contents = exportTrackGpx(day, raw, processed)

  if (isTauri)
    return invoke<string>('tracking_export_gpx', { fileName: `trip-track-${day}-${Date.now()}.gpx`, contents })

  const url = URL.createObjectURL(new Blob([contents], {
    type: 'application/gpx+xml',
  }))
  const link = document.createElement('a')
  link.href = url
  link.download = `trip-track-${day}.gpx`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)

  return 'Загрузка GPX начата'
}

export function originalTrackView(data: import('../models/types').DayData): import('../models/types').DayData {
  const points = (data.rawPoints ?? data.points).map(p => ({
    ...p,
    stop: undefined,
    activity: p.recordedActivity ?? p.activity,
    activitySource: 'automatic' as const,
  }))
  const routes: import('../models/types').RenderSegment[] = []

  for (const point of points) {
    const previous = routes.at(-1)?.points.at(-1) as DayPoint | undefined

    if (
      !previous
      || previous.sessionId !== point.sessionId
      || point.tsUtc - previous.tsUtc > 30_000
      || routes.at(-1)!.activity !== point.activity
    ) {
      routes.push({
        activity: point.activity,
        points: [],
        t0: point.tsUtc,
        t1: point.tsUtc,
      })
    }

    routes.at(-1)!.points.push(point)
    routes.at(-1)!.t1 = point.tsUtc
  }

  return {
    ...data,
    points,
    rawPoints: points,
    segments: [],
    preparedRenderSegments: routes,
  }
}
