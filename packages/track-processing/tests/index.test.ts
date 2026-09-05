import type { TrackPoint } from '../src/index'
import { describe, expect, it } from 'vitest'
import {
  catmullRomSpline,
  classifySegment,
  evaluatePointValidity,
  filterGpsOutliers,
  filterStaticDrift,
  normalizeSplineVertices,
  processDayTrack,
  rdpSimplify,
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
  let lat = 55.751
  let lng = 37.618
  for (let i = 0; i < 100; i++) {
    lng += (Math.random() - 0.5) * 0.00002 // дрожание ~1-2 м
    lat += (Math.random() - 0.5) * 0.00002
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
