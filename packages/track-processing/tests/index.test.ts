import type { TrackActivityType, TrackPoint } from '../src/index'
import { describe, expect, it } from 'vitest'
import {
  catmullRomSpline,
  classifySegment,
  consolidateSegments,
  deviceReco,
  evaluatePointValidity,
  filterGpsOutliers,
  filterStaticDrift,
  mergeStationaryPoints,
  movementEvidence,
  normalizeSplineVertices,
  processDayTrack,
  rdpSimplify,
  smoothActivityRuns,
  splitTrackIntoLegs,
  windowFeatures,
} from '../src/index'

let t = 1_735_689_600_000 // 2025-01-01T00:00 UTC

function pt(lat: number, lng: number, speedMs: number): TrackPoint {
  t += 2000
  return {
    clientPointId: `p-${t}`,
    tsUtc: t,
    lat,
    lng,
    altitude: 100,
    accuracy: 5,
    speed: speedMs,
    bearing: 0,
    activity: 'unknown',
    activityConfidence: 0,
    sessionId: 'test',
  }
}

function walkTrack(): TrackPoint[] {
  const out: TrackPoint[] = []
  let lat = 55.751
  let lng = 37.618
  for (let i = 0; i < 120; i++) {
    const speed = 1.2 + Math.sin(i / 4) * 0.5 // 2.5..6 км/ч
    lng += (speed * 2 / 111_320) / Math.cos(lat * Math.PI / 180)
    lat += (Math.sin(i / 8) * 0.4 * 2) / 111_320
    out.push(pt(lat, lng, speed))
  }
  return out
}

function bikeTrack(): TrackPoint[] {
  const out: TrackPoint[] = []
  let lat = 55.751
  let lng = 37.618
  for (let i = 0; i < 120; i++) {
    const speed = 5 + Math.sin(i / 6) * 3 // 7..29 км/ч
    lng += (speed * 2 / 111_320) / Math.cos(lat * Math.PI / 180)
    lat += (Math.sin(i / 10) * 1.5 * 2) / 111_32
    out.push(pt(lat, lng, speed))
  }
  return out
}

function carTrack(): TrackPoint[] {
  const out: TrackPoint[] = []
  const lat = 55.751
  let lng = 37.618
  for (let i = 0; i < 150; i++) {
    let speed = 14 // ~50 км/ч
    if (i % 40 === 0 || i % 40 === 1)
      speed = 0.2 // светофор
    lng += (speed * 2 / 111_320) / Math.cos(lat * Math.PI / 180)
    out.push(pt(lat, lng, speed))
  }
  return out
}

function trainTrack(): TrackPoint[] {
  const out: TrackPoint[] = []
  let lat = 55.751
  let lng = 37.618
  for (let i = 0; i < 240; i++) {
    const speed = 42 + Math.sin(i / 30) * 1.5 // ~150 км/ч, почти ровно
    lng += (speed * 2 / 111_320) / Math.cos(lat * Math.PI / 180)
    lat += (i * 0.000004)
    out.push(pt(lat, lng, speed))
  }
  return out
}

function stillTrack(): TrackPoint[] {
  const out: TrackPoint[] = []
  const baseLat = 55.751
  const baseLng = 37.618
  for (let i = 0; i < 100; i++) {
    const lng = baseLng + (Math.random() - 0.5) * 0.00002 // дрожание ~1-2 м
    const lat = baseLat + (Math.random() - 0.5) * 0.00002
    out.push(pt(lat, lng, Math.random() * 0.3))
  }
  return out
}

describe('filterStaticDrift', () => {
  it('схлопывает покой в одну точку', () => {
    const still = stillTrack()
    const filtered = filterStaticDrift(still)
    const span = Math.max(...filtered.map(p => p.lat)) - Math.min(...filtered.map(p => p.lat))
    expect(span * 111_320).toBeLessThan(10)
  })
})

describe('mergeStationaryPoints', () => {
  it('объединяет множество близких стояночных точек (в пределах 5м) в одну', () => {
    const baseLat = 55.751234
    const baseLng = 37.618456
    const stationaryPoints: TrackPoint[] = []
    let currentT = 1_700_000_000_000

    // Генерируем 50 точек стояния на месте с микро-дрейфом 1-3 метра
    for (let i = 0; i < 50; i++) {
      currentT += 3000 // каждые 3 сек
      stationaryPoints.push({
        clientPointId: `stat-${i}`,
        tsUtc: currentT,
        lat: baseLat + (Math.sin(i) * 0.00002), // ~1-2 метра
        lng: baseLng + (Math.cos(i) * 0.00002),
        altitude: 150,
        accuracy: 6,
        speed: 0.1,
        bearing: null,
        activity: 'still',
        activityConfidence: 90,
        sessionId: 'sess-1',
      })
    }

    const merged = mergeStationaryPoints(stationaryPoints, { maxDistanceM: 5.0 })
    expect(merged.length).toBe(1)
    expect(merged[0].clientPointId).toBe('stat-0')
    expect(merged[0].lat).toBeCloseTo(baseLat, 4)
    expect(merged[0].lng).toBeCloseTo(baseLng, 4)
    expect(merged[0].activity).toBe('still')
  })

  it('сохраняет точки реального движения при выходе за радиус 5м', () => {
    const p1 = pt(55.750, 37.610, 0.1) // стоянка
    const p2 = pt(55.75001, 37.61001, 0.1) // стоянка рядом (~1м)
    const p3 = pt(55.7501, 37.6101, 1.4) // пошел пешком (>10м)
    const p4 = pt(55.7502, 37.6102, 1.4) // идет дальше

    const merged = mergeStationaryPoints([p1, p2, p3, p4], { maxDistanceM: 5.0 })
    // p1 и p2 объединяются в одну, p3 и p4 сохраняются
    expect(merged.length).toBe(3)
    expect(merged[0].lat).toBeCloseTo(55.750005, 5)
    expect(merged[1].clientPointId).toBe(p3.clientPointId)
    expect(merged[2].clientPointId).toBe(p4.clientPointId)
  })

  it('разделяет стоянки при большом временном разрыве (разные плечи)', () => {
    const t0 = 1_700_000_000_000
    const p1 = { lat: 55.75, lng: 37.61, tsUtc: t0, speed: 0, activity: 'still' }
    const p2 = { lat: 55.75001, lng: 37.61001, tsUtc: t0 + 2000, speed: 0, activity: 'still' }
    // Прошло 2 часа в том же месте
    const p3 = { lat: 55.75002, lng: 37.61002, tsUtc: t0 + 2 * 3600 * 1000, speed: 0, activity: 'still' }

    const merged = mergeStationaryPoints([p1, p2, p3], { maxDistanceM: 5.0, maxGapTimeMs: 15 * 60 * 1000 })
    // p1 и p2 в первой стоянке, p3 — отдельная стоянка после паузы
    expect(merged.length).toBe(2)
  })
})

describe('rdpSimplify', () => {
  it('сжимает прямую до 2 точек', () => {
    const line: TrackPoint[] = []
    let lat = 55.7
    let lng = 37.6
    for (let i = 0; i < 100; i++) {
      lat += 0.0005
      lng += 0.0005
      line.push(pt(lat, lng, 10))
    }
    expect(rdpSimplify(line, 5)).toHaveLength(2)
  })
})

describe('catmullRomSpline', () => {
  it('сгущает полилинию и не выходит за bbox', () => {
    const line = [
      { lat: 55.7, lng: 37.6 },
      { lat: 55.75, lng: 37.65 },
      { lat: 55.8, lng: 37.7 },
    ]
    const spline = catmullRomSpline(line, 4)
    expect(spline.length).toBeGreaterThan(line.length)
    const pad = 1e-3
    for (const p of spline) {
      expect(p.lat).toBeGreaterThanOrEqual(Math.min(...line.map(q => q.lat)) - pad)
      expect(p.lat).toBeLessThanOrEqual(Math.max(...line.map(q => q.lat)) + pad)
    }
  })
})

describe('classifySegment', () => {
  it('пешком детектируется как walk', () => {
    expect(classifySegment(walkTrack()).activity).toBe('walk')
  })

  it('велосипед детектируется как bike', () => {
    expect(classifySegment(bikeTrack()).activity).toBe('bike')
  })

  it('авто детектируется как vehicle', () => {
    expect(classifySegment(carTrack()).activity).toBe('vehicle')
  })

  it('поезд детектируется как rail', () => {
    expect(classifySegment(trainTrack()).activity).toBe('rail')
  })

  it('покой детектируется как still', () => {
    expect(classifySegment(stillTrack()).activity).toBe('still')
  })
})

describe('processDayTrack', () => {
  it('смешанный день walk → train → walk даёт ≥2 сегмента с rail', () => {
    const day = [...walkTrack(), ...trainTrack(), ...walkTrack()]
    const segments = processDayTrack(day)
    expect(segments.length).toBeGreaterThanOrEqual(2)
    expect(segments.some(s => s.activity === 'rail')).toBe(true)
  })
})

describe('windowFeatures', () => {
  it('cV поезда ниже, чем у авто', () => {
    const fTrain = windowFeatures(trainTrack())
    const fCar = windowFeatures(carTrack())
    expect(fTrain.speedCv).toBeLessThan(fCar.speedCv)
  })
})

describe('filterGpsOutliers', () => {
  it('отсекает одиночный бумеранг-выброс (скачок далеко и сразу назад)', () => {
    const track = walkTrack().slice(0, 30)
    // Внедряем аномальный скачок в точку 15: улет на 3 км за 2 секунды
    track[15] = {
      ...track[15],
      lat: track[15].lat + 0.03, // ~3.3 км
      lng: track[15].lng + 0.03,
      speed: 1600 / 3.6,
    }

    const filtered = filterGpsOutliers(track)
    expect(filtered.length).toBe(track.length - 1)
    // Проверяем, что выброшенная точка отсутствует
    expect(filtered.some(p => p.clientPointId === track[15].clientPointId)).toBe(false)
  })

  it('сохраняет авиаперелет (большой dt, скорость самолета ~800 км/ч)', () => {
    const startPt = pt(55.75, 37.61, 5) // Москва
    // Перелет через 2 часа (7200 сек) в Сочи (~1360 км)
    const flightTime = 7200 * 1000
    t += flightTime
    const endPt: TrackPoint = {
      clientPointId: `p-${t}`,
      tsUtc: t,
      lat: 43.58,
      lng: 39.72,
      altitude: 10000,
      accuracy: 10,
      speed: 220, // ~800 км/ч
      bearing: 180,
      activity: 'unknown',
      activityConfidence: 0,
      sessionId: 'test',
    }

    const filtered = filterGpsOutliers([startPt, endPt])
    expect(filtered.length).toBe(2)
  })

  it('отсекает точки с критически плохой точностью GPS (> 140м)', () => {
    const validPt = pt(55.75, 37.61, 5)
    const badAccPt = { ...pt(55.751, 37.611, 5), accuracy: 250 }
    const validPt2 = pt(55.752, 37.612, 5)

    const filtered = filterGpsOutliers([validPt, badAccPt, validPt2])
    expect(filtered.length).toBe(2)
    expect(filtered.some(p => p.accuracy === 250)).toBe(false)
  })
})

describe('evaluatePointValidity', () => {
  it('определяет нормальное движение', () => {
    const p1 = { lat: 55.75, lng: 37.61, tsUtc: 10000 }
    const p2 = { lat: 55.7501, lng: 37.6101, tsUtc: 12000, speed: 1.5, accuracy: 5 }
    const res = evaluatePointValidity(p2, p1)
    expect(res.isValid).toBe(true)
    expect(res.isFlight).toBe(false)
  })

  it('детектирует аномальный гиперзвуковой скачок как невалидный', () => {
    const p1 = { lat: 55.75, lng: 37.61, tsUtc: 10000 }
    // Прыжок на 1 градус (~111 км) за 5 секунд = 80 000 км/ч!
    const p2 = { lat: 56.75, lng: 37.61, tsUtc: 15000, speed: 50, accuracy: 10 }
    const res = evaluatePointValidity(p2, p1)
    expect(res.isValid).toBe(false)
    expect(res.reason).toContain('Невозможная скорость')
  })
})

describe('splitTrackIntoLegs', () => {
  it('разбивает трек на отдельные плечи при паузе более 15 минут', () => {
    const p1 = { lat: 55.75, lng: 37.61, tsUtc: 1000 }
    const p2 = { lat: 55.751, lng: 37.611, tsUtc: 5000 }
    // Пауза 30 минут
    const p3 = { lat: 55.76, lng: 37.62, tsUtc: 5000 + 30 * 60 * 1000 }
    const p4 = { lat: 55.761, lng: 37.621, tsUtc: 5000 + 30 * 60 * 1000 + 4000 }

    const legs = splitTrackIntoLegs([p1, p2, p3, p4])
    expect(legs.length).toBe(2)
    expect(legs[0].points.length).toBe(2)
    expect(legs[1].points.length).toBe(2)
  })
})

describe('normalizeSplineVertices', () => {
  it('плавно пересчитывает сплайн при удалении любой промежуточной точки', () => {
    const pts = [
      { lat: 55.70, lng: 37.60 },
      { lat: 55.72, lng: 37.62 },
      { lat: 55.74, lng: 37.64 },
      { lat: 55.76, lng: 37.66 },
    ]
    const splineBefore = normalizeSplineVertices(pts, 4)
    expect(splineBefore.length).toBeGreaterThan(pts.length)

    // Удаляем вторую точку
    const ptsAfter = pts.filter((_, idx) => idx !== 1)
    const splineAfter = normalizeSplineVertices(ptsAfter, 4)
    expect(splineAfter.length).toBeGreaterThan(ptsAfter.length)
    expect(splineAfter[0].lat).toBeCloseTo(55.70, 2)
    expect(splineAfter[splineAfter.length - 1].lat).toBeCloseTo(55.76, 2)
  })
})

describe('robustness and edge cases in track processing', () => {
  it('отсекает начальный выброс GPS (кэшированная точка в другом городе), когда далее идут согласованные точки', () => {
    const badStart = pt(40.71, -74.00, 5) // Нью-Йорк (выброс)
    const trueP1 = pt(55.750, 37.610, 1.4) // Москва
    const trueP2 = pt(55.7501, 37.6101, 1.4)
    const trueP3 = pt(55.7502, 37.6102, 1.4)

    const filtered = filterGpsOutliers([badStart, trueP1, trueP2, trueP3])
    expect(filtered.length).toBe(3)
    expect(filtered.some(p => p.clientPointId === badStart.clientPointId)).toBe(false)
    expect(filtered[0].lat).toBeCloseTo(55.75, 2)
  })

  it('processDayTrack корректно рассчитывает дистанцию длинного сегмента и не обрезает хвост', () => {
    // 75 точек ходьбы
    const walk = walkTrack().slice(0, 75)
    const segments = processDayTrack(walk)
    expect(segments.length).toBeGreaterThan(0)
    const totalDist = segments.reduce((s, seg) => s + seg.features.distanceM, 0)
    // 75 шагов по ~2.5м = ~180м
    expect(totalDist).toBeGreaterThan(100)
    // Проверяем, что временной охват сегментов доходит до конца трека
    const lastSeg = segments[segments.length - 1]
    expect(lastSeg.points[lastSeg.points.length - 1].tsUtc).toBe(walk[walk.length - 1].tsUtc)
  })
})

// ─── Регресс: «сижу, а трекер говорит, что я на велосипеде» ───────────────────

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648
    return s / 2_147_483_648
  }
}

const METER_LAT = 1 / 111_320
const METER_LNG = (lat: number) => 1 / (111_320 * Math.cos(lat * Math.PI / 180))

/**
 * Покой: фиксы дрожат вокруг одной точки в пределах ±jitterM метров.
 * `reportedSpeedFromGeometry` воспроизводит баг старого клиента, который писал скорость
 * по смещению сырых фиксов — из-за неё покой превращался в велосипед.
 */
function sittingTrack(options: { count?: number, jitterM?: number, accuracy?: number, reportedSpeedFromGeometry?: boolean } = {}): TrackPoint[] {
  const count = options.count ?? 60
  const jitterM = options.jitterM ?? 12
  const accuracy = options.accuracy ?? 12
  const rand = seededRandom(42)
  const baseLat = 55.751
  const baseLng = 37.618
  const mLng = METER_LNG(baseLat)
  const out: TrackPoint[] = []
  let prev: { lat: number, lng: number } | null = null
  for (let i = 0; i < count; i++) {
    const lat = baseLat + (rand() - 0.5) * 2 * jitterM * METER_LAT
    const lng = baseLng + (rand() - 0.5) * 2 * jitterM * mLng
    const stepM = prev ? Math.hypot((lat - prev.lat) / METER_LAT, (lng - prev.lng) / mLng) : 0
    const p = pt(lat, lng, options.reportedSpeedFromGeometry ? stepM / 2 : 0)
    out.push({ ...p, accuracy, activity: 'bike', activityConfidence: 85 })
    prev = { lat, lng }
  }
  return out
}

/** Ровная поездка с заданной скоростью: фиксы согласованы с движением. */
function ridingTrack(options: { speedMs: number, seconds: number, accuracy?: number }): TrackPoint[] {
  const baseLat = 55.751
  const mLng = METER_LNG(baseLat)
  const count = Math.max(2, Math.round(options.seconds / 2))
  const lngStep = options.speedMs * 2 * mLng
  let lng = 37.618
  const out: TrackPoint[] = []
  for (let i = 0; i < count; i++) {
    lng += lngStep
    out.push({ ...pt(baseLat, lng, options.speedMs), accuracy: options.accuracy ?? 10 })
  }
  return out
}

describe('регресс: покой против движения', () => {
  it('движение подтверждается геометрией окна, а дрожание покоя — нет', () => {
    const sitting = movementEvidence(sittingTrack({ count: 40, jitterM: 12, accuracy: 12 }))
    // Даже при худшем случае дрожания (±12м) за 78 секунд нельзя «наехать» быстрее ходьбы
    expect(sitting.speedKmh).toBeLessThan(2.5)

    const riding = movementEvidence(ridingTrack({ speedMs: 4.2, seconds: 78, accuracy: 10 }))
    expect(riding.credible).toBe(true)
    expect(riding.speedKmh).toBeGreaterThan(10)
  })

  it('окно покоя с «велосипедной» скоростью и меткой bike остаётся покоем', () => {
    const sitting = sittingTrack({ count: 40, jitterM: 12, accuracy: 12, reportedSpeedFromGeometry: true })
    const segment = classifySegment(sitting, { activity: 'bike', share: 1 })
    expect(segment.activity).toBe('still')
  })

  it('день, проведённый сидя, не содержит сегмента велосипеда', () => {
    const segments = processDayTrack(sittingTrack({ count: 60, jitterM: 12, accuracy: 12, reportedSpeedFromGeometry: true }))
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.some(s => s.activity === 'bike')).toBe(false)
    expect(segments.some(s => s.activity === 'still')).toBe(true)
  })

  it('реальная поездка на велосипеде по-прежнему распознаётся как движение', () => {
    const segments = processDayTrack(ridingTrack({ speedMs: 4.2, seconds: 300, accuracy: 8 }))
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.every(s => s.activity === 'still')).toBe(false)
  })
})

// ─── Сигнал Activity Recognition (акселерометр устройства) ────────────────────

describe('сигнал устройства: Activity Recognition', () => {
  it('deviceReco считает взвешенную долю по уверенности точек', () => {
    const points = sittingTrack({ count: 4, jitterM: 5, accuracy: 8 })
    const withDevice = points.map((p, i) => ({
      ...p,
      deviceActivity: (i === 3 ? 'still' : 'bike') as TrackActivityType,
      deviceActivityConfidence: i === 3 ? 30 : 90,
    }))
    // Явно помечаем три точки велосипедом, четвёртая ниже порога и не участвует
    withDevice[0] = { ...withDevice[0], deviceActivity: 'bike', deviceActivityConfidence: 90 }
    withDevice[1] = { ...withDevice[1], deviceActivity: 'bike', deviceActivityConfidence: 90 }
    withDevice[2] = { ...withDevice[2], deviceActivity: 'bike', deviceActivityConfidence: 90 }
    expect(deviceReco(withDevice)).toEqual({ activity: 'bike', share: 1 })
  })

  it('сигнал ниже порога уверенности не учитывается', () => {
    const points = sittingTrack({ count: 5, jitterM: 5, accuracy: 8 }).map(p => ({
      ...p,
      deviceActivity: 'bike' as TrackActivityType,
      deviceActivityConfidence: 35,
    }))
    expect(deviceReco(points)).toBe('unknown')
  })

  it('медленная езда в «пешем» диапазоне (5 км/ч) различается по устройству', () => {
    // 5 км/ч — единственная скорость, где геометрия бессильна: пешком и на велосипеде
    // фиксы выглядят одинаково. Решает акселерометр.
    const slowRide = ridingTrack({ speedMs: 1.5, seconds: 300, accuracy: 12 })
    expect(processDayTrack(slowRide).some(s => s.activity === 'bike')).toBe(false)

    const withDevice = slowRide.map(p => ({
      ...p,
      deviceActivity: 'bike' as TrackActivityType,
      deviceActivityConfidence: 90,
    }))
    expect(processDayTrack(withDevice).some(s => s.activity === 'bike')).toBe(true)
  })

  it('на стоянке сигнал «велосипед» не переворачивает покой в движение', () => {
    // Телефон лежит на велосипеде у магазина: устройство может решить, что велосипед
    // «едет». Геометрия окна это опровергает, и покой остаётся покоем.
    const waiting = sittingTrack({ count: 60, jitterM: 6, accuracy: 12 }).map(p => ({
      ...p,
      deviceActivity: 'bike' as TrackActivityType,
      deviceActivityConfidence: 90,
    }))
    const segments = processDayTrack(waiting)
    expect(segments.some(s => s.activity === 'bike')).toBe(false)
  })

  it('покой с сигналом STILL не превращается в движение', () => {
    const sitting = sittingTrack({ count: 60, jitterM: 12, accuracy: 12, reportedSpeedFromGeometry: true }).map(p => ({
      ...p,
      deviceActivity: 'still' as TrackActivityType,
      deviceActivityConfidence: 90,
    }))
    const segments = processDayTrack(sitting)
    expect(segments.some(s => s.activity === 'bike')).toBe(false)
    expect(segments.some(s => s.activity === 'still')).toBe(true)
  })
})

describe('регресс: далёкие невалидные точки', () => {
  it('выброс на ~250м между соседними фиксами не попадает в трек', () => {
    const walk = walkTrack().slice(0, 30)
    const spiked = [...walk]
    const victim = walk[15]
    spiked[15] = { ...victim, lat: victim.lat + 0.002, lng: victim.lng + 0.002 }
    const filtered = filterGpsOutliers(spiked)
    expect(filtered.some(p => p.clientPointId === victim.clientPointId)).toBe(false)
    expect(filtered.length).toBe(29)
  })

  it('фикс с погрешностью хуже 65м не попадает в трек', () => {
    const walk = walkTrack().slice(0, 10)
    const noisy = [...walk]
    noisy[5] = { ...noisy[5], lat: noisy[5].lat + 0.01, lng: noisy[5].lng + 0.01, accuracy: 120 }
    const filtered = filterGpsOutliers(noisy)
    expect(filtered.some(p => p.accuracy === 120)).toBe(false)
    expect(filtered.length).toBe(9)
  })
})

describe('регресс: группировка точек в маршруте', () => {
  it('smoothActivityRuns поглощает короткую вставку чужой активности', () => {
    // 3-секундный шаг: велосипед 60с → пешком 30с (шум) → велосипед 120с
    const points = Array.from({ length: 70 }, (_, i) => ({ tsUtc: i * 3000 }))
    const raw: TrackActivityType[] = [
      ...Array.from({ length: 20 }, () => 'bike' as const),
      ...Array.from({ length: 10 }, () => 'walk' as const),
      ...Array.from({ length: 40 }, () => 'bike' as const),
    ]
    const smoothed = smoothActivityRuns(points, raw)
    expect(smoothed.includes('walk')).toBe(false)
    expect(smoothed.every(a => a === 'bike')).toBe(true)
  })

  it('smoothActivityRuns не трогает длинные состояния', () => {
    const points = Array.from({ length: 90 }, (_, i) => ({ tsUtc: i * 3000 }))
    const raw: TrackActivityType[] = [
      ...Array.from({ length: 30 }, () => 'bike' as const),
      ...Array.from({ length: 30 }, () => 'walk' as const),
      ...Array.from({ length: 30 }, () => 'bike' as const),
    ]
    expect(smoothActivityRuns(points, raw)).toEqual(raw)
  })

  it('consolidateSegments склеивает микро-сегменты и соседние сегменты одной активности', () => {
    const build = (activity: TrackActivityType, count: number, latFrom: number): TrackPoint[] => {
      const out: TrackPoint[] = []
      let lat = latFrom
      for (let i = 0; i < count; i++) {
        lat += 0.00001
        out.push({ ...pt(lat, 37.618, activity === 'still' ? 0 : 4), activity, activityConfidence: 90 })
      }
      return out
    }
    const makeSegment = (activity: TrackActivityType, points: TrackPoint[]) => ({
      points,
      activity,
      confidence: 0.8,
      features: windowFeatures(points),
    })

    const bikeBefore = build('bike', 150, 55.75) // 5 мин
    const walkBlip = build('walk', 10, 55.76) // 20 секунд, ~11 метров
    const bikeAfter = build('bike', 150, 55.77) // 5 мин

    const merged = consolidateSegments([
      makeSegment('bike', bikeBefore),
      makeSegment('walk', walkBlip),
      makeSegment('bike', bikeAfter),
    ])

    expect(merged.length).toBe(1)
    expect(merged[0].activity).toBe('bike')
    expect(merged[0].points[merged[0].points.length - 1].tsUtc).toBe(bikeAfter[bikeAfter.length - 1].tsUtc)
    expect(merged[0].features.durationMs).toBeGreaterThan(45_000)
  })

  it('в дне не остаётся сегментов короче 45 секунд и 120 метров', () => {
    const track = [...walkTrack(), ...ridingTrack({ speedMs: 5, seconds: 40, accuracy: 8 }), ...walkTrack()]
    const segments = processDayTrack(track)
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments)
      expect(seg.features.durationMs >= 45_000 || seg.features.distanceM >= 120).toBe(true)
  })
})
