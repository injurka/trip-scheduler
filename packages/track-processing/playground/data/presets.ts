import type { TrackActivityType, TrackPoint, TrackSegment } from '../../src/index'

let currentTimestamp = 1_747_000_000_000 // Fixed base date: May 2025

function makePoint(
  lat: number,
  lng: number,
  speedMs: number,
  altitude = 120,
  accuracy = 5,
  activity: TrackActivityType = 'unknown',
  bearing: number | null = null,
  sessionId = 'session-1',
): TrackPoint {
  currentTimestamp += 3000 // 3 seconds per fix
  return {
    clientPointId: `pt-${currentTimestamp}`,
    tsUtc: currentTimestamp,
    lat,
    lng,
    altitude,
    accuracy,
    speed: speedMs,
    bearing,
    activity,
    activityConfidence: 80,
    sessionId,
  }
}

export function generateWalkTrack(): TrackPoint[] {
  currentTimestamp = 1_747_000_000_000
  const out: TrackPoint[] = []
  let lat = 55.752
  let lng = 37.618
  for (let i = 0; i < 140; i++) {
    // 3.5 .. 5.5 km/h (1.0 .. 1.5 m/s)
    const speed = 1.1 + Math.sin(i / 5) * 0.35 + (Math.random() - 0.5) * 0.1
    const alt = 130 + Math.sin(i / 15) * 8
    lng += (speed * 3 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat += (Math.sin(i / 10) * 0.4 * 3) / 111_320
    out.push(makePoint(lat, lng, speed, alt, 4 + Math.random() * 3, 'walk'))
  }
  return out
}

export function generateBikeTrack(): TrackPoint[] {
  currentTimestamp = 1_747_000_000_000
  const out: TrackPoint[] = []
  let lat = 55.735
  let lng = 37.600
  for (let i = 0; i < 150; i++) {
    // 15 .. 28 km/h (4.2 .. 7.8 m/s)
    const speed = 5.5 + Math.sin(i / 8) * 2.2 + (Math.random() - 0.5) * 0.3
    const alt = 120 + Math.sin(i / 20) * 15
    lng += (speed * 3 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat += (Math.cos(i / 12) * 1.5 * 3) / 111_320
    out.push(makePoint(lat, lng, speed, alt, 4, 'bike'))
  }
  return out
}

export function generateCarTrack(): TrackPoint[] {
  currentTimestamp = 1_747_000_000_000
  const out: TrackPoint[] = []
  let lat = 55.750
  let lng = 37.580
  for (let i = 0; i < 160; i++) {
    let speed = 15.5 + Math.sin(i / 6) * 3 // ~55 km/h
    // Traffic lights around i = 35..45 and 95..105
    if ((i >= 35 && i <= 43) || (i >= 95 && i <= 104)) {
      speed = 0.1
    }
    const alt = 140 + (i * 0.1)
    lng += (speed * 3 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat += (Math.sin(i / 30) * 0.8 * 3) / 111_320
    out.push(makePoint(lat, lng, speed, alt, 5, 'vehicle'))
  }
  return out
}

export function generateTrainTrack(): TrackPoint[] {
  currentTimestamp = 1_747_000_000_000
  const out: TrackPoint[] = []
  let lat = 55.760
  let lng = 37.550
  for (let i = 0; i < 220; i++) {
    // High speed train: 140..175 km/h, very steady speed (low cV)
    const speed = 44 + Math.sin(i / 40) * 2
    const alt = 135 + Math.sin(i / 35) * 6
    lng += (speed * 3 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat += (i * 0.000008)
    out.push(makePoint(lat, lng, speed, alt, 3, 'rail'))
  }
  return out
}

export function generateStillTrack(): TrackPoint[] {
  currentTimestamp = 1_747_000_000_000
  const out: TrackPoint[] = []
  const centerLat = 55.7539
  const centerLng = 37.6208
  for (let i = 0; i < 100; i++) {
    // GPS wandering in 2-8 meters radius with low speed
    const jitterM = (Math.random() - 0.5) * 0.00006
    const lat = centerLat + jitterM
    const lng = centerLng + (Math.random() - 0.5) * 0.00008
    const speed = Math.random() * 0.35 // < 0.4 m/s
    out.push(makePoint(lat, lng, speed, 125, 8 + Math.random() * 8, 'still'))
  }
  return out
}

export function generateSpikesTrack(): TrackPoint[] {
  // Base walk track with 2 severe boomerang spikes (outliers)
  const track = generateWalkTrack()

  // Spike 1: Boomerang jump at point 35 (jumps ~2.5 km and returns immediately)
  if (track[35]) {
    track[35] = {
      ...track[35],
      lat: track[35].lat + 0.022,
      lng: track[35].lng + 0.028,
      speed: 120, // impossible jump
      accuracy: 65,
    }
  }

  // Spike 2: Boomerang jump at point 80
  if (track[80]) {
    track[80] = {
      ...track[80],
      lat: track[80].lat - 0.035,
      lng: track[80].lng - 0.015,
      speed: 95,
      accuracy: 90,
    }
  }

  return track
}

export function generateMultiModalDayTrack(): TrackPoint[] {
  currentTimestamp = 1_747_000_000_000
  const out: TrackPoint[] = []
  let lat = 55.7512
  let lng = 37.6184

  // Phase 1: Walk to station (60 points)
  for (let i = 0; i < 60; i++) {
    const speed = 1.3 + Math.sin(i / 4) * 0.3
    lng += (speed * 3 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat += (Math.sin(i / 8) * 0.3 * 3) / 111_320
    out.push(makePoint(lat, lng, speed, 120, 5, 'walk'))
  }

  // Phase 2: Dwell at train platform (30 points)
  const platLat = lat
  const platLng = lng
  for (let i = 0; i < 30; i++) {
    out.push(makePoint(
      platLat + (Math.random() - 0.5) * 0.00003,
      platLng + (Math.random() - 0.5) * 0.00003,
      0.1,
      120,
      7,
      'still',
    ))
  }

  // Phase 3: Train travel (120 points, ~130 km/h)
  for (let i = 0; i < 120; i++) {
    const speed = 36 + Math.sin(i / 20) * 2
    lng += (speed * 3 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat += (i * 0.00001)
    out.push(makePoint(lat, lng, speed, 130 + i * 0.2, 4, 'rail'))
  }

  // Phase 4: Bicycle to restaurant (50 points, ~18 km/h)
  for (let i = 0; i < 50; i++) {
    const speed = 5.2 + Math.sin(i / 6) * 1.5
    lng += (speed * 3 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat += (Math.cos(i / 10) * 1.2 * 3) / 111_320
    out.push(makePoint(lat, lng, speed, 154, 5, 'bike'))
  }

  // Phase 5: Long stay at restaurant (50 points, still)
  const restLat = lat
  const restLng = lng
  for (let i = 0; i < 50; i++) {
    out.push(makePoint(
      restLat + (Math.random() - 0.5) * 0.00004,
      restLng + (Math.random() - 0.5) * 0.00004,
      0.2,
      154,
      8,
      'still',
    ))
  }

  // Phase 6: Taxi / Vehicle back (70 points, ~50 km/h)
  for (let i = 0; i < 70; i++) {
    const speed = (i % 25 < 4) ? 0.2 : 14.5 + Math.sin(i / 5) * 2
    lng -= (speed * 2.5 / 111_320) / Math.cos((lat * Math.PI) / 180)
    lat -= (speed * 1.5 / 111_320)
    out.push(makePoint(lat, lng, speed, 140, 5, 'vehicle'))
  }

  return out
}

export interface PresetScenario {
  id: string
  name: string
  icon: string
  description: string
  pointsCount: number
  generate: () => TrackPoint[]
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'walk',
    name: 'Пешеходная прогулка',
    icon: 'lucide:footprints',
    description: 'Городской пеший маршрут со скоростью 3.5–5.5 км/ч, реалистичным джиттером GPS и профилем высоты',
    pointsCount: 140,
    generate: generateWalkTrack,
  },
  {
    id: 'bike',
    name: 'Велосипед',
    icon: 'lucide:bike',
    description: 'Динамичный веломаршрут со скоростью 15–28 км/ч, ускорениями, торможениями и виражами',
    pointsCount: 150,
    generate: generateBikeTrack,
  },
  {
    id: 'car',
    name: 'Автомобиль (светофоры)',
    icon: 'lucide:car',
    description: 'Поездка на машине 40–70 км/ч с остановками на красных сигналах светофора и разгонами',
    pointsCount: 160,
    generate: generateCarTrack,
  },
  {
    id: 'train',
    name: 'Скоростной поезд',
    icon: 'lucide:train',
    description: 'Длинный перегон 140–180 км/ч с минимальной вариацией скорости (низкий cV) и плавной кривизной',
    pointsCount: 220,
    generate: generateTrainTrack,
  },
  {
    id: 'still',
    name: 'Стоянка в кафе (дрейф GPS)',
    icon: 'lucide:coffee',
    description: 'Скопление 100 точек на одном месте со скоростью < 0.4 м/с и плавающими координатами для проверки схлопывания',
    pointsCount: 100,
    generate: generateStillTrack,
  },
  {
    id: 'spikes',
    name: 'GPS Выбросы и бумеранги',
    icon: 'lucide:zap-off',
    description: 'Трек с аномальными скачками координат на 2.5–3.5 км и обратно для стресс-теста filterGpsOutliers',
    pointsCount: 140,
    generate: generateSpikesTrack,
  },
  {
    id: 'multimodal',
    name: 'Мультимодальный день (Full Day)',
    icon: 'lucide:route',
    description: 'Полный сценарий дня: Пешком → Поезд → Велосипед → Стоянка в ресторане → Такси для тестирования processDayTrack',
    pointsCount: 380,
    generate: generateMultiModalDayTrack,
  },
]

/** Simple GPX parser for custom file uploads */
export function parseGpx(gpxText: string): TrackPoint[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(gpxText, 'application/xml')
  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  if (trkpts.length === 0) {
    throw new Error('Файл не содержит точек <trkpt>')
  }

  return trkpts.map((pt, idx) => {
    const lat = Number.parseFloat(pt.getAttribute('lat') || '0')
    const lng = Number.parseFloat(pt.getAttribute('lon') || '0')
    const eleNode = pt.querySelector('ele')
    const timeNode = pt.querySelector('time')

    const altitude = eleNode ? Number.parseFloat(eleNode.textContent || '0') : 100
    let tsUtc = Date.now() + idx * 3000
    if (timeNode?.textContent) {
      const parsed = Date.parse(timeNode.textContent)
      if (!Number.isNaN(parsed))
        tsUtc = parsed
    }

    let speed: number | null = null
    const speedNode = pt.querySelector('speed')
    if (speedNode?.textContent) {
      speed = Number.parseFloat(speedNode.textContent)
    }

    return {
      clientPointId: `gpx-${idx}-${tsUtc}`,
      tsUtc,
      lat,
      lng,
      altitude,
      accuracy: 5,
      speed,
      bearing: null,
      activity: 'unknown',
      activityConfidence: 0,
      sessionId: 'uploaded-gpx',
    }
  })
}

/** GeoJSON export helper */
export function exportToGeoJson(points: TrackPoint[], segments?: TrackSegment[]): string {
  const features: any[] = []

  if (segments && segments.length > 0) {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      features.push({
        type: 'Feature',
        properties: {
          segmentIndex: i,
          activity: seg.activity,
          confidence: seg.confidence,
          p50SpeedKmh: seg.features.p50SpeedKmh,
          distanceM: seg.features.distanceM,
        },
        geometry: {
          type: 'LineString',
          coordinates: seg.points.map((p: TrackPoint) => [p.lng, p.lat, p.altitude ?? 0]),
        },
      })
    }
  }
  else if (points.length > 0) {
    features.push({
      type: 'Feature',
      properties: {
        pointsCount: points.length,
      },
      geometry: {
        type: 'LineString',
        coordinates: points.map(p => [p.lng, p.lat, p.altitude ?? 0]),
      },
    })
  }

  const geoJson = {
    type: 'FeatureCollection',
    features,
  }

  return JSON.stringify(geoJson, null, 2)
}

/** GeoJSON points parser for custom file uploads */
export function parseGeoJsonPoints(geoJson: any): TrackPoint[] {
  let coords: [number, number, number?][] = []

  if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
    for (const f of geoJson.features) {
      if (f.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates)) {
        coords.push(...f.geometry.coordinates)
      }
      else if (f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
        coords.push(f.geometry.coordinates as [number, number, number?])
      }
    }
  }
  else if (geoJson.type === 'Feature' && geoJson.geometry?.type === 'LineString') {
    coords = geoJson.geometry.coordinates
  }

  const baseTime = Date.now()
  return coords.map((c, idx) => ({
    clientPointId: `geojson-${idx}`,
    tsUtc: baseTime + idx * 3000,
    lng: c[0],
    lat: c[1],
    altitude: c[2] ?? 100,
    accuracy: 5,
    speed: 5,
    bearing: null,
    activity: 'unknown',
    activityConfidence: 0,
    sessionId: 'uploaded-geojson',
  }))
}
