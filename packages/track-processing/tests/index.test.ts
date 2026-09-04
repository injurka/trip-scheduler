import type { TrackPoint } from '../src/index'
import { describe, expect, it } from 'vitest'
import { catmullRomSpline, classifySegment, filterStaticDrift, processDayTrack, rdpSimplify, windowFeatures } from '../src/index'

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
