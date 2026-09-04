export interface TrackPoint {
  clientPointId: string
  tsUtc: number
  lat: number
  lng: number
  altitude: number | null
  accuracy: number | null
  speed: number | null
  bearing: number | null
  activity: TrackActivityType
  activityConfidence: number
  sessionId: string
}

export type TrackActivityType = 'still' | 'walk' | 'bike' | 'vehicle' | 'rail' | 'unknown'

/** Короткий алиас для потребителей на клиенте. */
export type ActivityType = TrackActivityType

// ─── Геометрия ────────────────────────────────────────────────────────────────

const EARTH_R = 6_371_000
const rad = (d: number) => (d * Math.PI) / 180

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a
    = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(a))
}

/** Начальный азимут p1 → p2, градусы 0..360. */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = rad(lat1)
  const φ2 = rad(lat2)
  const Δλ = rad(lng2 - lng1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// ─── Фильтрация шума ──────────────────────────────────────────────────────────

/**
 * Удаляет статический дрейф: при скорости < 0.5 м/с точка дальше 2 м от якоря
 * считается шумом и схлопывается в якорь (координаты заменяются, ts сохраняется).
 */
export function filterStaticDrift(points: TrackPoint[], maxDriftM = 2): TrackPoint[] {
  const out: TrackPoint[] = []
  let anchor: TrackPoint | null = null
  for (const p of points) {
    const speed = p.speed ?? 0
    if (speed < 0.5) {
      if (!anchor) {
        anchor = p
        out.push(p)
        continue
      }
      const d = haversineM(anchor.lat, anchor.lng, p.lat, p.lng)
      if (d <= maxDriftM) {
        out.push({ ...p, lat: anchor.lat, lng: anchor.lng })
        continue
      }
      // отошли дальше порога — якорь переносится
      anchor = p
      out.push(p)
      continue
    }
    anchor = null
    out.push(p)
  }
  return out
}

/**
 * Медианный фильтр позиций (окно 3): устойчив к одиночным GPS-скачкам.
 */
export function medianFilter(points: TrackPoint[]): TrackPoint[] {
  if (points.length < 3)
    return points
  const out: TrackPoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const win = [points[i - 1], points[i], points[i + 1]]
    win.sort((a, b) => a.lat - b.lat)
    const lat = win[1].lat
    win.sort((a, b) => a.lng - b.lng)
    const lng = win[1].lng
    out.push({ ...points[i], lat, lng })
  }
  out.push(points[points.length - 1])
  return out
}

// ─── Рамер-Дуглас-Пекер ───────────────────────────────────────────────────────

/** RDP для массива точек; порог в метрах. */
export function rdpSimplify(points: TrackPoint[], epsilonM: number): TrackPoint[] {
  if (points.length <= 2)
    return [...points]

  const keep = Array.from({ length: points.length }).fill(false)
  keep[0] = keep[points.length - 1] = true

  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [start, end] = stack.pop()!
    let maxDist = -1
    let idx = -1
    const a = points[start]
    const b = points[end]
    for (let i = start + 1; i < end; i++) {
      const d = pointToSegmentDistanceM(points[i], a, b)
      if (d > maxDist) {
        maxDist = d
        idx = i
      }
    }
    if (maxDist > epsilonM && idx > 0) {
      keep[idx] = true
      stack.push([start, idx], [idx, end])
    }
  }
  return points.filter((_, i) => keep[i])
}

function pointToSegmentDistanceM(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  // Локальная метрическая СК вокруг точки p (достаточно для сегментов < 100 км)
  const cosLat = Math.cos(rad(p.lat))
  const ax = (a.lng - p.lng) * cosLat * (Math.PI / 180) * EARTH_R
  const ay = (a.lat - p.lat) * (Math.PI / 180) * EARTH_R
  const bx = (b.lng - p.lng) * cosLat * (Math.PI / 180) * EARTH_R
  const by = (b.lat - p.lat) * (Math.PI / 180) * EARTH_R
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0)
    return Math.hypot(ax, ay)
  let t = ((-ax) * dx + (-ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

// ─── Catmull-Rom сплайн (для визуализации) ────────────────────────────────────

export interface SplinePoint {
  lat: number
  lng: number
}

/**
 * Стандартный Catmull-Rom (uniform). subdivPerSegment — число интерполированных
 * точек на сегмент.
 */
export function catmullRomSpline(points: SplinePoint[], subdivPerSegment = 6): SplinePoint[] {
  if (points.length < 3)
    return [...points]
  const out: SplinePoint[] = []
  const pts = [points[0], ...points, points[points.length - 1]]
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]]
    for (let j = 0; j < subdivPerSegment; j++) {
      const t = j / subdivPerSegment
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        lat: 0.5 * ((2 * p1.lat) + (-p0.lat + p2.lat) * t
          + (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2
          + (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3),
        lng: 0.5 * ((2 * p1.lng) + (-p0.lng + p2.lng) * t
          + (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2
          + (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3),
      })
    }
  }
  out.push(points[points.length - 1])
  return out
}

// ─── Кинематические признаки окна ─────────────────────────────────────────────

export interface WindowFeatures {
  p50SpeedKmh: number
  p90SpeedKmh: number
  speedCv: number
  meanTurnRateDegPerKm: number
  straightness: number
  stopCount: number
  stopGapMsMedian: number
  durationMs: number
  distanceM: number
}

export function windowFeatures(points: TrackPoint[]): WindowFeatures {
  const n = points.length
  if (n < 2) {
    return { p50SpeedKmh: 0, p90SpeedKmh: 0, speedCv: 1, meanTurnRateDegPerKm: 180, straightness: 0, stopCount: 0, stopGapMsMedian: 0, durationMs: 0, distanceM: 0 }
  }

  const speedsKmh = points.map(p => (p.speed ?? 0) * 3.6).sort((a, b) => a - b)
  const p = (q: number) => speedsKmh[Math.min(n - 1, Math.floor(q * n))]
  const p50 = p(0.5)
  const mean = speedsKmh.reduce((s, v) => s + v, 0) / n
  const variance = speedsKmh.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const cv = mean > 0.5 ? Math.sqrt(variance) / mean : 1

  let pathM = 0
  let netM = 0
  let turnDeg = 0
  let prevBearing: number | null = null
  for (let i = 1; i < n; i++) {
    const a = points[i - 1]
    const b = points[i]
    const d = haversineM(a.lat, a.lng, b.lat, b.lng)
    pathM += d
    if (d > 15) {
      const br = bearingDeg(a.lat, a.lng, b.lat, b.lng)
      if (prevBearing !== null) {
        let Δ = Math.abs(br - prevBearing)
        if (Δ > 180)
          Δ = 360 - Δ
        turnDeg += Δ
      }
      prevBearing = br
    }
  }
  netM = haversineM(points[0].lat, points[0].lng, points[n - 1].lat, points[n - 1].lng)

  let stopCount = 0
  const gaps: number[] = []
  let stopStart: number | null = null
  for (const pt of points) {
    const moving = (pt.speed ?? 0) >= 0.7
    if (!moving && stopStart === null)
      stopStart = pt.tsUtc
    if (moving && stopStart !== null) {
      const gap = pt.tsUtc - stopStart
      if (gap >= 20_000) {
        stopCount++
        gaps.push(gap)
      }
      stopStart = null
    }
  }
  if (stopStart !== null) {
    const gap = points[n - 1].tsUtc - stopStart
    if (gap >= 20_000) {
      stopCount++
      gaps.push(gap)
    }
  }
  gaps.sort((a, b) => a - b)
  const stopGapMsMedian = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0

  const durationMs = points[n - 1].tsUtc - points[0].tsUtc
  return {
    p50SpeedKmh: p50,
    p90SpeedKmh: p(0.9),
    speedCv: cv,
    meanTurnRateDegPerKm: pathM > 100 ? turnDeg / (pathM / 1000) : 180,
    straightness: pathM > 0 ? netM / pathM : 0,
    stopCount,
    stopGapMsMedian,
    durationMs,
    distanceM: pathM,
  }
}

// ─── Классификация ────────────────────────────────────────────────────────────

export interface TrackSegment {
  points: TrackPoint[]
  activity: TrackActivityType
  confidence: number
  features: WindowFeatures
}

/**
 * Классификация сегмента: голос Activity Recognition (prior) + кинематика.
 */
export function classifySegment(points: TrackPoint[], recoHint: TrackActivityType = 'unknown'): TrackSegment {
  const f = windowFeatures(points)
  const kinematic = kinematicVotes(f)
  const rail = railScoreOf(f)

  const scores: Record<TrackActivityType, number> = {
    still: kinematic.still,
    walk: kinematic.walk,
    bike: kinematic.bike,
    vehicle: kinematic.vehicle,
    rail,
    unknown: 0,
  }

  if (recoHint !== 'unknown' && recoHint !== 'rail') {
    // Recognition видит акселерометр — сильный prior; rail он всегда зовёт vehicle
    const boost: Record<TrackActivityType, number> = { still: 1.5, walk: 1.5, bike: 1.4, vehicle: 1.4, rail: 0, unknown: 0 }
    const target: TrackActivityType = recoHint === 'vehicle' && rail > 0.6 ? 'rail' : recoHint
    scores[target] = scores[target] * boost[target] + 0.5
  }

  if (rail >= 0.65 && scores.rail >= scores.vehicle)
    scores.rail += 0.5

  let best: TrackActivityType = 'unknown'
  let bestScore = -1
  let total = 0
  for (const [k, v] of Object.entries(scores)) {
    total += v
    if (v > bestScore) {
      best = k as TrackActivityType
      bestScore = v
    }
  }
  const confidence = total > 0 ? Math.min(1, bestScore / Math.max(total, 1e-9)) : 0

  const finalType: TrackActivityType = confidence < 0.35 ? 'unknown' : best
  return { points, activity: finalType, confidence, features: f }
}

function kinematicVotes(f: WindowFeatures): { still: number, walk: number, bike: number, vehicle: number } {
  const v = f.p50SpeedKmh
  const still
    = (v < 1.5 ? 1 : 0)
      + (f.stopCount >= Math.max(1, (f.durationMs / 60_000) / 10) ? 0.5 : 0)
  const walk
    = (v > 1 && v < 7 ? 1 : v <= 1 ? 0.3 : 0)
      + (f.speedCv > 0.35 ? 0.5 : 0)
      + (f.meanTurnRateDegPerKm > 150 ? 0.5 : 0)
  const bike
    = (v >= 8 && v <= 35 ? 1 : 0)
      + (f.speedCv > 0.2 && f.speedCv < 0.6 ? 0.4 : 0)
      + (f.stopCount > 0 && f.stopGapMsMedian < 90_000 ? 0.3 : 0)
      + (f.meanTurnRateDegPerKm > 40 && f.straightness < 0.85 ? 0.3 : 0)
  const vehicle
    = (v > 7 && v <= 130 ? 1 : 0)
      + (f.straightness > 0.5 ? 0.3 : 0)
      + (f.stopCount > 0 ? 0.2 : 0)
  return { still, walk, bike, vehicle }
}

/**
 * Детекция поезда: три независимых голоса.
 *  1. Крейсерская скорость: окно ≥ 4 мин, p50 ≥ 45 км/ч, CV < 0.25
 *  2. Прямолинейность: turn rate < 30°/км ИЛИ straightness > 0.85
 *  3. Отсутствие городских остановок: stopCount ≤ 1, паузы > 2 мин (вокзалы)
 */
export function railScoreOf(f: WindowFeatures): number {
  let s = 0
  const longEnough = f.durationMs >= 4 * 60_000
  if (longEnough && f.p50SpeedKmh >= 45 && f.speedCv < 0.25)
    s += 0.45
  if (longEnough && f.p50SpeedKmh >= 30 && f.speedCv < 0.2)
    s += 0.15
  if (f.meanTurnRateDegPerKm < 30 || f.straightness > 0.85)
    s += 0.3
  if (f.stopCount <= 1 && (f.stopCount === 0 || f.stopGapMsMedian > 120_000))
    s += 0.25
  if (f.p50SpeedKmh >= 60 && f.p90SpeedKmh < 220)
    s += 0.1
  return Math.min(1, s)
}

/**
 * Пост-обработка дня: фильтр → скользящие окна → classify → слияние → RDP.
 */
export function processDayTrack(raw: TrackPoint[]): TrackSegment[] {
  const cleaned = medianFilter(filterStaticDrift(raw))
  const winSize = 40
  const step = 20
  const classified: TrackSegment[] = []

  let i = 0
  while (i + winSize <= cleaned.length) {
    const win = cleaned.slice(i, i + winSize)
    const hint = dominantReco(win)
    classified.push(classifySegment(win, hint))
    i += step
  }
  if (classified.length === 0 && cleaned.length > 1) {
    classified.push(classifySegment(cleaned, dominantReco(cleaned)))
  }

  const merged: TrackSegment[] = []
  for (const seg of classified) {
    const last = merged[merged.length - 1]
    if (last && last.activity === seg.activity) {
      last.points = last.points
        .concat(seg.points)
        .filter((p, idx, arr) => idx === 0 || p.tsUtc !== arr[idx - 1].tsUtc)
    }
    else {
      merged.push({ ...seg, points: [...seg.points] })
    }
  }

  const eps: Record<TrackActivityType, number> = { still: 5, walk: 3, bike: 5, vehicle: 7, rail: 15, unknown: 5 }
  for (const seg of merged) {
    seg.points = rdpSimplify(seg.points, eps[seg.activity])
  }
  return merged.filter(s => s.points.length > 1)
}

function dominantReco(points: TrackPoint[]): TrackActivityType {
  const counts = new Map<TrackActivityType, number>()
  for (const p of points)
    counts.set(p.activity, (counts.get(p.activity) ?? 0) + 1)
  let best: TrackActivityType = 'unknown'
  let n = 0
  for (const [k, v] of counts) {
    if (v > n) {
      best = k
      n = v
    }
  }
  return best
}
