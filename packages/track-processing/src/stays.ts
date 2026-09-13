import type { TrackPoint } from './index'
import { haversineM } from './index'

export interface TrackStop {
  startedAt: number
  endedAt: number
  lat: number
  lng: number
  radiusM: number
  samplesCount: number
}

export type DisplayTrackPoint = TrackPoint & { stop?: TrackStop }

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/** Bounded robust estimate; a reported accuracy is a weight, not a guarantee. */
function center(points: TrackPoint[]) {
  const stride = Math.max(1, Math.floor(points.length / 120))
  const sample = points.filter((_, i) => i % stride === 0)
  const origin = sample[0]
  const scale = Math.max(0.01, Math.cos(origin.lat * Math.PI / 180))
  const xs = sample.map(p => (p.lng - origin.lng) * 111_320 * scale)
  const ys = sample.map(p => (p.lat - origin.lat) * 111_320)
  let x = median(xs)
  let y = median(ys)
  for (let iteration = 0; iteration < 12; iteration++) {
    let sx = 0
    let sy = 0
    let weight = 0
    sample.forEach((p, i) => {
      const w = 1 / (Math.max(5, p.accuracy ?? 25) ** 2 * Math.max(0.5, Math.hypot(xs[i] - x, ys[i] - y)))
      sx += xs[i] * w
      sy += ys[i] * w
      weight += w
    })
    x = sx / weight
    y = sy / weight
  }
  return { lat: origin.lat + y / 111_320, lng: origin.lng + x / (111_320 * scale) }
}

function movingSignal(p: TrackPoint): boolean {
  return p.deviceActivity != null && p.deviceActivity !== 'unknown' && p.deviceActivity !== 'still'
    && (p.deviceActivityConfidence ?? 0) >= 50
}

/**
 * Detect dwell before smoothing. Three sustained departure fixes release a fixed anchor.
 * Time gaps and sessions are handled by the caller. Input and measurement metadata are immutable.
 */
export function collapseStayPoints(points: TrackPoint[]): DisplayTrackPoint[] {
  const out: DisplayTrackPoint[] = points.map(p => ({ ...p }))
  let start = 0
  while (start < points.length - 3) {
    let end = start + 1
    while (end < points.length && (points[end].tsUtc - points[start].tsUtc < 90_000 || end - start < 3))
      end++
    if (end >= points.length)
      break
    const window = points.slice(start, end + 1)
    if (window.length < 4 || window.filter(movingSignal).length > window.length * 0.2) {
      start++
      continue
    }
    const anchor = center(window)
    const radius = Math.max(8, Math.min(35, median(window.map(p => p.accuracy ?? 25)) * 1.5))
    const distances = window.map(p => haversineM(anchor.lat, anchor.lng, p.lat, p.lng))
    const third = Math.max(1, Math.floor(window.length / 3))
    const first = center(window.slice(0, third))
    const last = center(window.slice(-third))
    // A consistent slow walk must not become a stop even if it fits inside the radius.
    const displacement = haversineM(first.lat, first.lng, last.lat, last.lng)
    if (distances.filter(d => d <= radius).length < window.length * 0.85
      || displacement > Math.max(6, radius * 0.6)) {
      start++
      continue
    }
    let departure = -1
    let stopEnd = end
    for (let i = end + 1; i < points.length; i++) {
      const p = points[i]
      const leaving = movingSignal(p) || haversineM(anchor.lat, anchor.lng, p.lat, p.lng) > radius * 1.5
      if (leaving) {
        if (departure < 0)
          departure = i
        if (i - departure >= 2 && p.tsUtc - points[departure].tsUtc >= 6_000)
          break
      }
      else {
        departure = -1
        stopEnd = i
      }
    }
    const stop: TrackStop = {
      ...anchor,
      startedAt: points[start].tsUtc,
      endedAt: points[stopEnd].tsUtc,
      radiusM: Math.round(Math.max(radius, median(distances))),
      samplesCount: stopEnd - start + 1,
    }
    for (let i = start; i <= stopEnd; i++)
      out[i] = { ...points[i], ...anchor, speed: 0, activity: 'still', stop }
    start = stopEnd + 1
  }
  return out
}

/** Accuracy-weighted adaptive position filter; resets at dwell boundaries. */
export function smoothMovingPoints(points: DisplayTrackPoint[]): DisplayTrackPoint[] {
  let variance = 25
  const filtered: DisplayTrackPoint[] = []
  return points.map((p) => {
    const prev = filtered[filtered.length - 1]
    if (!prev || p.stop || prev.stop) {
      variance = Math.max(3, p.accuracy ?? 25) ** 2
      filtered.push({ ...p })
      return { ...p }
    }
    const dt = Math.max(0.1, (p.tsUtc - prev.tsUtc) / 1000)
    const d = haversineM(prev.lat, prev.lng, p.lat, p.lng)
    variance += Math.max(4, (p.speed ?? d / dt) ** 2) * dt * dt
    const noise = Math.max(3, p.accuracy ?? 25) ** 2
    const gain = Math.max(0.35, variance / (variance + noise))
    variance *= 1 - gain
    const next = { ...p, lat: prev.lat + gain * (p.lat - prev.lat), lng: prev.lng + gain * (p.lng - prev.lng) }
    filtered.push(next)
    return next
  })
}
