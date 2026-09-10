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
  /**
   * Активность по системному Activity Recognition (сырой сигнал акселерометра/сенсоров ОС),
   * а не по GPS. Заполняется только мобильным клиентом; у серверных точек, загруженных без неё, — undefined.
   */
  deviceActivity?: TrackActivityType | null
  /** Уверенность Activity Recognition, 0..100 (шкала Google). */
  deviceActivityConfidence?: number | null
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

export interface MergeStationaryPointsOptions {
  /** Максимальное расстояние в метрах между точками скопления (по умолчанию 5м) */
  maxDistanceM?: number
  /** Максимальный разрыв во времени в мс для разделения независимых стоянок/плеч (по умолчанию 15 мин) */
  maxGapTimeMs?: number
  /** Максимальная скорость для точки покоя в м/с (по умолчанию 0.7 м/с) */
  maxStationarySpeedMs?: number
}

/**
 * Объединяет последовательные скопления точек в радиусе maxDistanceM (по умолчанию 5 метров),
 * когда устройство находится на одном месте (стоянка / сидение на месте).
 *
 * Предотвращает появление сотен паразитных точек-дубликатов, петель в сплайнах
 * и нагромождения маркеров на карте. При объединении сохраняется первая точка скопления
 * (с обновленным временем последней активности в кластере или средневзвешенными координатами).
 */
export function mergeStationaryPoints<T extends { lat: number, lng: number, tsUtc: number, speed?: number | null, activity?: string }>(
  points: T[],
  options: MergeStationaryPointsOptions = {},
): T[] {
  if (points.length <= 1)
    return [...points]

  const maxDistanceM = options.maxDistanceM ?? 5.0
  const maxGapTimeMs = options.maxGapTimeMs ?? 15 * 60 * 1000
  const maxStationarySpeedMs = options.maxStationarySpeedMs ?? 0.7

  const out: T[] = []
  let cluster: T[] = []

  const flushCluster = () => {
    if (cluster.length === 0)
      return

    if (cluster.length === 1) {
      out.push(cluster[0])
      cluster = []
      return
    }

    // Для группы в пределах 5м формируем единую репрезентативную точку
    // Вычисляем средневзвешенные центроидные координаты
    let sumLat = 0
    let sumLng = 0
    for (const p of cluster) {
      sumLat += p.lat
      sumLng += p.lng
    }
    const centerLat = sumLat / cluster.length
    const centerLng = sumLng / cluster.length

    // Если первая точка была стояночной, сохраняем её метаданные,
    // но центрируем координаты и фиксируем tsUtc первой точки кластера
    const first = cluster[0]
    out.push({
      ...first,
      lat: centerLat,
      lng: centerLng,
      speed: 0,
      activity: first.activity === 'unknown' ? 'still' : first.activity,
    })
    cluster = []
  }

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    const ptSpeed = pt.speed ?? 0
    const isPotentiallyStill = ptSpeed <= maxStationarySpeedMs || pt.activity === 'still'

    if (cluster.length === 0) {
      cluster.push(pt)
      continue
    }

    const anchor = cluster[0]
    const last = cluster[cluster.length - 1]
    const dt = pt.tsUtc - last.tsUtc
    const distFromAnchor = haversineM(anchor.lat, anchor.lng, pt.lat, pt.lng)

    // Если есть большой разрыв во времени (> 15 мин), сбрасываем кластер чтобы не ломать временные плечи
    const isTimeGap = dt > maxGapTimeMs

    // Точка считается частью того же стояночного скопления, если расстояние <= maxDistanceM
    // и она либо медленная/покоится, либо предыдущая в кластере тоже стояла и расстояние крайне мало
    const isNearby = distFromAnchor <= maxDistanceM

    if (!isTimeGap && isNearby && isPotentiallyStill) {
      cluster.push(pt)
    }
    else if (!isTimeGap && isNearby && cluster.length > 1 && ptSpeed <= maxStationarySpeedMs * 1.5) {
      // Плавный переход при начале движения
      cluster.push(pt)
    }
    else {
      flushCluster()
      cluster.push(pt)
    }
  }

  flushCluster()
  return out
}

export interface PointValidityResult {
  isValid: boolean
  isFlight: boolean
  isGap: boolean
  /**
   * Смещение от предыдущей точки меньше погрешности GPS: движение не подтверждено,
   * это шум покоя. Точка валидна как фикс, но не должна трактоваться как перемещение.
   */
  isNoise: boolean
  reason?: string
  estimatedSpeedKmh: number
  /** Порог в метрах, ниже которого смещение неотличимо от шума GPS. */
  uncertaintyM: number
}

/** Точность, принимаемая для фиксов без заявленной accuracy. */
export const ASSUMED_ACCURACY_M = 25

/** Максимальная заявленная точность фикса (м): хуже — точка не сохраняется вообще. */
export const MAX_ACCURACY_M = 65

/**
 * Порог неотличимости смещения от шума GPS. Устройство с точностью ±acc метров даёт
 * разброс координат того же порядка, поэтому смещение меньше этого порога — не движение,
 * а дрожание фикса. Именно из-за отсутствия такой проверки «сидящий» трек уезжал в велосипед:
 * 10–20 метров дрожания за 3 секунды давали «достоверные» 12–24 км/ч.
 */
export function movementUncertaintyM(
  accA?: number | null,
  accB?: number | null,
  minM = 2.5,
  k = 1,
): number {
  const a = accA ?? ASSUMED_ACCURACY_M
  const b = accB ?? ASSUMED_ACCURACY_M
  return Math.max(minM, Math.max(a, b) * k)
}

/**
 * Оценка валидности точки относительно предыдущей точки с учетом времени и расстояния.
 * Позволяет отличать:
 * 1) Нормальное движение (пешком, авто, поезд).
 * 2) Шум покоя (смещение меньше погрешности GPS).
 * 3) Быстрое перемещение / Авиаперелет (большой dt, скорость до 1150 км/ч).
 * 4) GPS-сбой / аномальный скачок (короткий dt, физически невозможная скорость).
 * 5) Разрыв записи / отключение GPS (большой dt без аномальной скорости).
 */
export function evaluatePointValidity(
  current: { lat: number, lng: number, tsUtc: number, accuracy?: number | null, speed?: number | null },
  prev?: { lat: number, lng: number, tsUtc: number, accuracy?: number | null },
  options: { maxAccuracyM?: number } = {},
): PointValidityResult {
  const maxAccuracyM = options.maxAccuracyM ?? MAX_ACCURACY_M
  const uncertaintyM = movementUncertaintyM(current.accuracy, prev?.accuracy)

  // 1. Проверка точности GPS (если передана и слишком плохая для использования координаты)
  if (current.accuracy != null && current.accuracy > maxAccuracyM) {
    return {
      isValid: false,
      isFlight: false,
      isGap: false,
      isNoise: false,
      reason: `Низкая точность GPS (> ${maxAccuracyM}м)`,
      estimatedSpeedKmh: 0,
      uncertaintyM,
    }
  }

  if (!prev) {
    return { isValid: true, isFlight: false, isGap: false, isNoise: false, estimatedSpeedKmh: 0, uncertaintyM }
  }

  const dtSec = Math.max(0.1, (current.tsUtc - prev.tsUtc) / 1000)
  const dM = haversineM(prev.lat, prev.lng, current.lat, current.lng)
  const speedMs = dM / dtSec
  const speedKmh = speedMs * 3.6

  // Проверка на разрыв по времени (например, телефон спал или GPS был выключен)
  const isGap = dtSec > 15 * 60 // разрыв более 15 минут

  // 2. Смещение меньше погрешности GPS — это дрожание фикса, а не перемещение
  if (dM <= uncertaintyM) {
    return {
      isValid: true,
      isFlight: false,
      isGap,
      isNoise: true,
      estimatedSpeedKmh: 0,
      uncertaintyM,
    }
  }

  // Авиаперелет: скорость свыше 320 км/ч, но в пределах физических возможностей пассажирской авиации (≤ 1150 км/ч)
  const isFlight = (speedKmh > 320 && speedKmh <= 1150) || (isGap && dM > 50_000 && speedKmh <= 1150)

  // Аномалия 1: Физически невозможная скорость даже для авиации (> 1250 км/ч)
  if (speedKmh > 1250) {
    return {
      isValid: false,
      isFlight: false,
      isGap,
      reason: `Невозможная скорость перемещения (${Math.round(speedKmh)} км/ч)`,
      estimatedSpeedKmh: speedKmh,
      isNoise: false,
      uncertaintyM,
    }
  }

  // Аномалия 2: Мгновенный телепорт (при малом dt < 90 сек скорость выше 380 км/ч для наземного движения)
  if (dtSec < 90 && speedKmh > 380) {
    return {
      isValid: false,
      isFlight: false,
      isGap: false,
      isNoise: false,
      uncertaintyM,
      reason: `Аномальный скачок GPS (${Math.round(dM)}м за ${Math.round(dtSec)}с)`,
      estimatedSpeedKmh: speedKmh,
    }
  }

  return {
    isValid: true,
    isFlight,
    isGap,
    isNoise: false,
    estimatedSpeedKmh: speedKmh,
    uncertaintyM,
  }
}

export interface OutlierFilterOptions {
  /** Максимальная скорость в км/ч (по умолчанию 1150) */
  maxSpeedKmh?: number
  /** Порог персентиля скорости для отсечения локальных выбросов (по умолч. 0.95) */
  percentileThreshold?: number
  /** Отсекать ли одиночные бумеранги (отскоки туда-обратно) */
  filterBoomerangs?: boolean
  /** Точность фикса (м), хуже которой точка отбрасывается целиком (по умолч. MAX_ACCURACY_M) */
  maxAccuracyM?: number
}

/**
 * Нормализация и фильтрация GPS-выбросов с использованием персентилей скорости,
 * геометрического анализа треугольников (детект бумерангов/скачков) и учета авиаперелетов.
 */
export function filterGpsOutliers<T extends { lat: number, lng: number, tsUtc: number, accuracy?: number | null, speed?: number | null }>(
  points: T[],
  options: OutlierFilterOptions = {},
): T[] {
  if (points.length <= 2)
    return [...points]

  const maxSpeedKmh = options.maxSpeedKmh ?? 1150
  const filterBoomerangs = options.filterBoomerangs !== false
  const maxAccuracyM = options.maxAccuracyM ?? MAX_ACCURACY_M
  const percentile = options.percentileThreshold ?? 0.95

  // Шаг 1: базовый отсев явных аномалий точности и абсолютной гиперзвуковой скорости
  const stage1: T[] = []
  const rejectedBuffer: T[] = []

  /** Физически невозможное перемещение с учётом погрешности GPS: скачок меньше погрешности — это шум, а не телепорт. */
  const isImpossibleMove = (
    a: { lat: number, lng: number, tsUtc: number, accuracy?: number | null },
    b: { lat: number, lng: number, tsUtc: number, accuracy?: number | null },
  ) => {
    const dt = Math.max(0.1, (b.tsUtc - a.tsUtc) / 1000)
    const d = haversineM(a.lat, a.lng, b.lat, b.lng)
    if (d <= movementUncertaintyM(a.accuracy, b.accuracy))
      return false
    const v = (d / dt) * 3.6
    return v > maxSpeedKmh || (dt < 45 && v > 360)
  }

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]

    // Фикс с точностью хуже maxAccuracyM бесполезен: его координата может лежать в десятках метров от правды
    if (pt.accuracy != null && pt.accuracy > maxAccuracyM)
      continue

    if (stage1.length > 0) {
      const prev = stage1[stage1.length - 1]
      if (isImpossibleMove(prev, pt)) {
        rejectedBuffer.push(pt)
        // Если накопилось ≥ 2 отклоненных подряд точек, проверяем их взаимную согласованность:
        // если они согласованы друг с другом, значит выбросом была предыдущая якорная точка!
        if (rejectedBuffer.length >= 2) {
          const r1 = rejectedBuffer[rejectedBuffer.length - 2]
          const r2 = rejectedBuffer[rejectedBuffer.length - 1]
          if (!isImpossibleMove(r1, r2)) {
            // Предыдущая якорная точка была ложным выбросом — убираем её и восстанавливаем согласованные точки
            stage1.pop()
            stage1.push(...rejectedBuffer)
            rejectedBuffer.length = 0
            continue
          }
        }
        continue
      }
    }

    rejectedBuffer.length = 0
    stage1.push(pt)
  }

  if (stage1.length <= 2)
    return stage1

  // Шаг 2: Вычисление персентилей скорости между соседними точками для адаптивной калибровки
  const pairSpeeds: number[] = []
  for (let i = 1; i < stage1.length; i++) {
    const p1 = stage1[i - 1]
    const p2 = stage1[i]
    const dt = Math.max(0.1, (p2.tsUtc - p1.tsUtc) / 1000)
    if (dt < 300) {
      const d = haversineM(p1.lat, p1.lng, p2.lat, p2.lng)
      pairSpeeds.push((d / dt) * 3.6)
    }
  }

  pairSpeeds.sort((a, b) => a - b)
  const p95 = pairSpeeds.length > 10
    ? pairSpeeds[Math.floor(pairSpeeds.length * percentile)]
    : 120
  const p98 = pairSpeeds.length > 10
    ? pairSpeeds[Math.floor(pairSpeeds.length * Math.min(0.99, percentile + 0.03))]
    : 160

  // Порог «подозрительно быстро»: адаптивен к треку, но не ниже 55 км/ч, чтобы отскок на 20–50 м
  // между соседними фиксами не маскировался под нормальную езду. Удаление всё равно требует
  // геометрического расхождения (петля), поэтому порог сам по себе ложных срабатываний не даёт.
  const outlierSpeedThreshold = Math.max(55, Math.min(Math.max(p95 * 1.8, p98 * 1.4), 320))

  // Шаг 3: Детекция бумерангов (скачков A -> B -> C, где B отскакивает далеко, а A и C рядом)
  const keep = Array.from({ length: stage1.length }).fill(true)

  if (filterBoomerangs) {
    for (let i = 1; i < stage1.length - 1; i++) {
      const A = stage1[i - 1]
      const B = stage1[i]
      const C = stage1[i + 1]

      const dAB = haversineM(A.lat, A.lng, B.lat, B.lng)
      const dBC = haversineM(B.lat, B.lng, C.lat, C.lng)
      const dAC = haversineM(A.lat, A.lng, C.lat, C.lng)

      const dtAB = Math.max(0.1, (B.tsUtc - A.tsUtc) / 1000)
      const dtBC = Math.max(0.1, (C.tsUtc - B.tsUtc) / 1000)
      const vAB = (dAB / dtAB) * 3.6
      const vBC = (dBC / dtBC) * 3.6

      // Порог петли масштабируется погрешностью GPS: отскок на 30 м при точности ±25 м — это шум фикса,
      // отскок на 300 м при точности ±8 м — реальный выброс, который надо убрать.
      const detourFloorM = Math.max(60, 6 * movementUncertaintyM(A.accuracy, B.accuracy, 2.5, 1))
      const isDetour = (dAB + dBC) > detourFloorM && (dAB + dBC) > 3 * Math.max(dAC, 12)
      const isHighSpeed = vAB > outlierSpeedThreshold || vBC > outlierSpeedThreshold

      if (isDetour && isHighSpeed) {
        keep[i] = false
      }
    }
  }

  return stage1.filter((_, i) => keep[i])
}

// ─── Окно движения (доказательство перемещения) ─────────────────────────────

export interface MovementEvidence {
  /** Длительность окна (мс) */
  windowMs: number
  /** Прямое смещение от первого фикса окна к последнему (м) — устойчиво к дрожанию, в отличие от суммы шагов */
  netM: number
  /** Сумма шагов по окну (м) */
  pathM: number
  /** Медиана заявленной точности фиксов окна (м) */
  accuracyM: number
  /** Перемещение достоверно: прямое смещение уверенно превышает погрешность GPS */
  credible: boolean
  /** Доверенная скорость по окну (м/с) */
  speedMs: number
  /** Доверенная скорость по окну (км/ч) */
  speedKmh: number
  fixes: number
}

/** Минимум фиксов и времени окна, при которых оценка скорости вообще осмысленна. */
export const MIN_EVIDENCE_FIXES = 3
export const MIN_EVIDENCE_WINDOW_MS = 15_000
/** Минимальное прямое смещение окна, считающееся движением (м). */
export const MIN_EVIDENCE_NET_M = 15
/**
 * Во сколько раз прямое смещение окна должно превышать заявленную погрешность (1σ),
 * чтобы движение считалось доказанным. 2σ отсекает «доказательства» из дрожания фиксов.
 */
export const EVIDENCE_ACCURACY_K = 2

/**
 * Оценка движения по окну фиксов. В отличие от пары соседних точек, прямое смещение
 * за 30–60 секунд не «раздувается» дрожанием координат: у стоящего устройства оно
 * остаётся в пределах погрешности, у пешехода — набирает десятки метров, у велосипеда — сотни.
 * Именно это различает «сижу, а трекер говорит велосипед».
 */
export function movementEvidence(
  points: Array<{ lat: number, lng: number, tsUtc: number, accuracy?: number | null }>,
  options: { maxAccuracyM?: number } = {},
): MovementEvidence {
  const maxAccuracyM = options.maxAccuracyM ?? MAX_ACCURACY_M
  const accs: number[] = []
  const clean: Array<{ lat: number, lng: number, tsUtc: number }> = []

  for (const p of points) {
    if (p.accuracy != null && p.accuracy > maxAccuracyM)
      continue
    accs.push(p.accuracy ?? ASSUMED_ACCURACY_M)
    clean.push({ lat: p.lat, lng: p.lng, tsUtc: p.tsUtc })
  }

  clean.sort((a, b) => a.tsUtc - b.tsUtc)

  const empty: MovementEvidence = {
    windowMs: 0,
    netM: 0,
    pathM: 0,
    accuracyM: 0,
    credible: false,
    speedMs: 0,
    speedKmh: 0,
    fixes: clean.length,
  }

  if (clean.length < MIN_EVIDENCE_FIXES)
    return empty

  const windowMs = clean[clean.length - 1].tsUtc - clean[0].tsUtc
  if (windowMs < MIN_EVIDENCE_WINDOW_MS)
    return { ...empty, windowMs }

  const accuracyM = medianNumber(accs)
  const netM = haversineM(clean[0].lat, clean[0].lng, clean[clean.length - 1].lat, clean[clean.length - 1].lng)

  let pathM = 0
  for (let i = 1; i < clean.length; i++)
    pathM += haversineM(clean[i - 1].lat, clean[i - 1].lng, clean[i].lat, clean[i].lng)

  // Порог достоверности: прямое смещение должно уверенно превышать погрешность фикса.
  // Погрешность в треке — это радиус 68% (1σ), а смещение двух независимых фиксов
  // распределено с σ ≈ √2·accuracy, поэтому порог берём не в 1σ (тогда ~78% окон покоя
  // случайно «доказывают» движение), а в 2σ: у стоящего устройства окно проходит в ~37%
  // случаев, а идущий (≥ 90 м за 78 с) остаётся достоверным даже при точности 40 м.
  const uncertaintyM = Math.max(MIN_EVIDENCE_NET_M, accuracyM * EVIDENCE_ACCURACY_K)
  const credible = netM >= uncertaintyM
  const speedMs = credible ? netM / (windowMs / 1000) : 0

  return {
    windowMs,
    netM,
    pathM,
    accuracyM,
    credible,
    speedMs,
    speedKmh: speedMs * 3.6,
    fixes: clean.length,
  }
}

function medianNumber(values: number[]): number {
  if (values.length === 0)
    return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Медианный фильтр позиций (окно 3): устойчив к одиночным GPS-скачкам.
 */
export function medianFilter(points: TrackPoint[]): TrackPoint[] {
  if (points.length < 3)
    return points
  const out: TrackPoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1]
    const pCur = points[i]
    const pNext = points[i + 1]

    // Не применяем медианный фильтр на границах временных пауз / разрывов (> 15 мин)
    if (pCur.tsUtc - pPrev.tsUtc > 15 * 60_000 || pNext.tsUtc - pCur.tsUtc > 15 * 60_000) {
      out.push(pCur)
      continue
    }

    const win = [pPrev, pCur, pNext]
    win.sort((a, b) => a.lat - b.lat)
    const lat = win[1].lat
    win.sort((a, b) => a.lng - b.lng)
    const lng = win[1].lng
    out.push({ ...pCur, lat, lng })
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

export interface TrackLeg<T> {
  points: T[]
  isFlight: boolean
  isGap: boolean
}

/**
 * Центростремительный (centripetal, alpha = 0.5) Catmull-Rom сплайн.
 * В отличие от uniform Catmull-Rom, центростремительный сплайн математически
 * гарантирует отсутствие самопересечений, петель и перелетов при неравномерном
 * расстоянии между точками трека.
 */
export function centripetalCatmullRom(
  points: SplinePoint[],
  subdivPerSegment = 6,
  alpha = 0.5,
): SplinePoint[] {
  if (points.length < 2)
    return [...points]
  if (points.length === 2)
    return [...points]

  // Удаляем близкие дубликаты (< 0.5 метра)
  const deduped: SplinePoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = deduped[deduped.length - 1]
    const d = haversineM(prev.lat, prev.lng, points[i].lat, points[i].lng)
    if (d >= 0.5) {
      deduped.push(points[i])
    }
  }

  if (deduped.length <= 2)
    return deduped

  const n = deduped.length
  const pts = [deduped[0], ...deduped, deduped[n - 1]]
  const out: SplinePoint[] = []

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2]

    const getT = (tPrev: number, pA: SplinePoint, pB: SplinePoint) => {
      const d = Math.hypot(pB.lng - pA.lng, pB.lat - pA.lat)
      return tPrev + (Math.max(d, 1e-9) ** alpha)
    }

    const t0 = 0
    const t1 = getT(t0, p0, p1)
    const t2 = getT(t1, p1, p2)
    const t3 = getT(t2, p2, p3)

    for (let j = 0; j < subdivPerSegment; j++) {
      const t = t1 + (j / subdivPerSegment) * (t2 - t1)

      const a1Lat = ((t1 - t) * p0.lat + (t - t0) * p1.lat) / (t1 - t0)
      const a1Lng = ((t1 - t) * p0.lng + (t - t0) * p1.lng) / (t1 - t0)
      const a2Lat = ((t2 - t) * p1.lat + (t - t1) * p2.lat) / (t2 - t1)
      const a2Lng = ((t2 - t) * p1.lng + (t - t1) * p2.lng) / (t2 - t1)
      const a3Lat = ((t3 - t) * p2.lat + (t - t2) * p3.lat) / (t3 - t2)
      const a3Lng = ((t3 - t) * p2.lng + (t - t2) * p3.lng) / (t3 - t2)

      const b1Lat = ((t2 - t) * a1Lat + (t - t0) * a2Lat) / (t2 - t0)
      const b1Lng = ((t2 - t) * a1Lng + (t - t0) * a2Lng) / (t2 - t0)
      const b2Lat = ((t3 - t) * a2Lat + (t - t1) * a3Lat) / (t3 - t1)
      const b2Lng = ((t3 - t) * a2Lng + (t - t1) * a3Lng) / (t3 - t1)

      const cLat = ((t2 - t) * b1Lat + (t - t1) * b2Lat) / (t2 - t1)
      const cLng = ((t2 - t) * b1Lng + (t - t1) * b2Lng) / (t2 - t1)

      if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
        out.push({ lat: cLat, lng: cLng })
      }
    }
  }

  out.push(deduped[deduped.length - 1])
  return out
}

/**
 * Обратная совместимость: catmullRomSpline делегирует в centripetalCatmullRom,
 * гарантируя отсутствие петель и стабильность при удалении любых точек.
 */
export function catmullRomSpline(points: SplinePoint[], subdivPerSegment = 6): SplinePoint[] {
  return centripetalCatmullRom(points, subdivPerSegment, 0.5)
}

/**
 * Разбивает последовательность точек на непрерывные плечи/участки (legs),
 * чтобы не соединять единой непрерывной кривой места, где GPS долго не работал
 * (например, телефон спал 2 часа) или происходил дальний авиаперелет.
 */
export function splitTrackIntoLegs<T extends { lat: number, lng: number, tsUtc: number }>(
  points: T[],
  maxGapTimeMs = 15 * 60 * 1000,
  maxGapDistanceM = 8000,
): TrackLeg<T>[] {
  if (points.length === 0)
    return []

  const legs: TrackLeg<T>[] = []
  let currentLeg: T[] = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const dt = cur.tsUtc - prev.tsUtc
    const dist = haversineM(prev.lat, prev.lng, cur.lat, cur.lng)
    const vKmh = dt > 0 ? (dist / (dt / 1000)) * 3.6 : 0

    const isTimeGap = dt > maxGapTimeMs
    const isDistGap = dist > maxGapDistanceM && vKmh < 350
    const isFlightJump = dist > 40_000 && vKmh > 350

    if (isTimeGap || isDistGap || isFlightJump) {
      if (currentLeg.length > 0) {
        legs.push({ points: currentLeg, isFlight: isFlightJump, isGap: isTimeGap || isDistGap })
      }
      currentLeg = [cur]
    }
    else {
      currentLeg.push(cur)
    }
  }

  if (currentLeg.length > 0) {
    legs.push({ points: currentLeg, isFlight: false, isGap: false })
  }

  return legs
}

/**
 * Нормализует вершины и строит центростремительный сплайн для каждой непрерывной секции.
 * Гарантирует, что при удалении любой точки геометрия пересчитывается без поломки
 * и без неестественных паразитных петель через весь город.
 */
export function normalizeSplineVertices(
  points: SplinePoint[],
  subdivPerSegment = 6,
): SplinePoint[] {
  if (points.length < 2)
    return [...points]
  if (points.length === 2)
    return [...points]

  return centripetalCatmullRom(points, subdivPerSegment, 0.5)
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
  /** Геометрия окна подтверждает перемещение (прямое смещение больше погрешности GPS). */
  movementCredible: boolean
  /** Доверенная скорость окна по геометрии (км/ч), 0 если движение не подтверждено. */
  evidenceSpeedKmh: number
}

export function windowFeatures(points: TrackPoint[]): WindowFeatures {
  const n = points.length
  if (n < 2) {
    return { p50SpeedKmh: 0, p90SpeedKmh: 0, speedCv: 1, meanTurnRateDegPerKm: 180, straightness: 0, stopCount: 0, stopGapMsMedian: 0, durationMs: 0, distanceM: 0, movementCredible: false, evidenceSpeedKmh: 0 }
  }

  // Геометрия окна — арбитр заявленной скорости: устройство (или клиент) может писать «еду 25 км/ч»,
  // пока за окно не набралось даже смещения в пределах погрешности GPS. Тогда окно — стояние.
  const evidence = movementEvidence(points)
  const windowSec = Math.max(1, evidence.windowMs / 1000)
  // Шумовой пол окна: фикс с погрешностью ±acc сам «проходит» до ~1.5·acc метров за окно.
  const noiseFloorKmh = Math.min(evidence.accuracyM, 60) * 1.5 / windowSec * 3.6
  // Заявленная скорость не может вдвое превышать подтверждённую геометрией, иначе покой
  // с дрожащими фиксами снова превращается в велосипед.
  // ... Если движения нет — доверенная скорость окна равна нулю (а не «шумовому полу»):
  // шумовой пол — это не оценка скорости, а ширина полосы неопределённости, и подставлять
  // его как скорость нельзя, иначе стоящий телефон с точностью 40 м «едет» ~2.8 км/ч и
  // классификатор ставит ходьбу.
  const capKmh = evidence.credible ? Math.max(evidence.speedKmh * 2, noiseFloorKmh) : 0
  const capMs = capKmh / 3.6

  const speedsKmh = points.map(pt => Math.min((pt.speed ?? 0) * 3.6, capKmh)).sort((a, b) => a - b)
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
    const moving = Math.min(pt.speed ?? 0, capMs) >= 0.7
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
    movementCredible: evidence.credible,
    evidenceSpeedKmh: evidence.credible ? evidence.speedKmh : 0,
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
 * Подсказка от распознавания активности. Либо просто активность, либо она же
 * с весом `share` — долей точек окна, которые её подтверждают.
 */
export type RecoHint = TrackActivityType | { activity: TrackActivityType, share?: number }

/** Минимальная длительность состояния активности: более короткие вставки считаются шумом классификации. */
export const MIN_ACTIVITY_DWELL_MS = 45_000
/**
 * Порог уверенности Activity Recognition (0..100), ниже которого сигнал устройства игнорируется.
 * Google регулярно отдаёт «unknown» и короткие перескоки с уверенностью 30-45 — они не должны
 * перевешивать геометрию окна.
 */
export const DEVICE_ACTIVITY_MIN_CONFIDENCE = 50
/** Минимальная дистанция, при которой короткий сегмент остаётся самостоятельным (м). */
export const MIN_SEGMENT_DISTANCE_M = 120

function normalizeRecoHint(recoHint: RecoHint): { activity: TrackActivityType, share: number } {
  if (typeof recoHint === 'string')
    return { activity: recoHint, share: 1 }
  return { activity: recoHint.activity, share: Math.max(0, Math.min(1, recoHint.share ?? 1)) }
}

/**
 * Классификация сегмента: голос Activity Recognition (prior) + кинематика.
 */
export function classifySegment(points: TrackPoint[], recoHint: RecoHint = 'unknown'): TrackSegment {
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

  const hint = normalizeRecoHint(recoHint)
  if (hint.activity !== 'unknown' && hint.activity !== 'rail') {
    // Recognition видит акселерометр — сильный prior; rail он всегда зовёт vehicle.
    // Вес prior пропорционален доле подтверждающих точек: одиночная «велосипедная»
    // точка в окне покоя больше не переворачивает классификацию всего окна.
    const boost: Record<TrackActivityType, number> = { still: 1.5, walk: 1.5, bike: 1.4, vehicle: 1.4, rail: 0, unknown: 0 }
    const target: TrackActivityType = hint.activity === 'vehicle' && rail > 0.6 ? 'rail' : hint.activity
    const w = hint.share
    // Ходьба и велосипед — единственная пара, которую кинематика принципиально не
    // различает: 5 км/ч бывает и пешком, и на велосипеде. Акселерометр их различает,
    // поэтому здесь его голос решающий, а не совещательный. Покой и быстрые бэнды
    // остаются за геометрией: устройства с «велосипедом» на стоянке недостаточно.
    const additive = target === 'walk' || target === 'bike' ? 1.2 * w : 0.5 * w
    scores[target] = scores[target] * (1 + (boost[target] - 1) * w) + additive
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
  // Геометрия окна не подтвердила перемещение: окно длинное, а прямого смещения,
  // уверенно превышающего погрешность GPS, нет. «Стою на месте» для человека,
  // велосипеда и машины — одно и то же состояние, поэтому это факт, а не голос:
  // голосование с ненулевым шумовым полом позволяло стоящему телефону набрать ходьбу.
  if (!f.movementCredible && f.durationMs >= MIN_EVIDENCE_WINDOW_MS)
    return { still: 2, walk: 0, bike: 0, vehicle: 0 }

  const v = f.p50SpeedKmh
  // Нижняя граница ходьбы — 2.5 км/ч: ниже неё шум покоя (дрожание фиксов в пределах
  // погрешности) неотличим от перемещения, и «сижу» перестаёт превращаться в «иду/еду».
  const still
    = (v < 2.5 ? 1 : 0)
      + (f.stopCount >= Math.max(1, (f.durationMs / 60_000) / 10) ? 0.5 : 0)
  const walk
    = (v >= 2.5 && v < 8 ? 1 : v < 2.5 ? 0.3 : 0)
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
 * Пост-обработка дня: фильтр → разбиение на плечи → классификация без дублирования точек → RDP.
 */
export function processDayTrack(raw: TrackPoint[]): TrackSegment[] {
  if (raw.length < 2)
    return []

  // 1. Очистка от шума и выбросов
  const cleaned = medianFilter(filterStaticDrift(filterGpsOutliers(raw)))
  if (cleaned.length < 2)
    return []

  // 2. Разделение на непрерывные плечи (без разрывов по времени/расстоянию)
  const legs = splitTrackIntoLegs(cleaned)
  const classifiedSegments: TrackSegment[] = []
  const winSize = 40
  const step = 10

  for (const leg of legs) {
    const pts = leg.points
    if (pts.length < 2)
      continue

    const legSegments: TrackSegment[] = []

    // Если плечо слишком короткое для скользящего окна, классифицируем целиком
    if (pts.length <= winSize) {
      const seg = classifySegment(pts, dominantReco(pts))
      legSegments.push(seg)
      classifiedSegments.push(...consolidateSegments(legSegments))
      continue
    }

    // Голосование скользящих окон для каждой точки плеча
    const pointVotes: Array<Map<TrackActivityType, number>> = pts.map(() => new Map())

    let i = 0
    while (i + winSize <= pts.length) {
      const win = pts.slice(i, i + winSize)
      const seg = classifySegment(win, dominantReco(win))
      for (let k = i; k < i + winSize; k++) {
        const votes = pointVotes[k]
        votes.set(seg.activity, (votes.get(seg.activity) ?? 0) + (seg.confidence || 0.5))
      }
      i += step
    }

    // Хвостовые точки покрываем последним окном
    const lastWinStart = Math.max(0, pts.length - winSize)
    const tailWin = pts.slice(lastWinStart)
    const tailSeg = classifySegment(tailWin, dominantReco(tailWin))
    for (let k = lastWinStart; k < pts.length; k++) {
      const votes = pointVotes[k]
      votes.set(tailSeg.activity, (votes.get(tailSeg.activity) ?? 0) + (tailSeg.confidence || 0.5))
    }

    // Определяем активность для каждой точки по большинству голосов
    const pointActivities: TrackActivityType[] = []
    const pointVoteConfidence: number[] = []
    for (let idx = 0; idx < pts.length; idx++) {
      const votes = pointVotes[idx]
      let bestAct: TrackActivityType = pts[idx].activity || 'unknown'
      let maxScore = -1
      let totalScore = 0
      for (const [act, score] of votes.entries()) {
        totalScore += score
        if (score > maxScore) {
          maxScore = score
          bestAct = act
        }
      }
      pointActivities.push(bestAct)
      pointVoteConfidence.push(totalScore > 0 ? maxScore / totalScore : 0)
    }

    // Гасим короткие вставки чужой активности: одиночное окно не должно дробить маршрут
    const smoothedActivities = smoothActivityRuns(pts, pointActivities)

    // Группируем последовательные точки одной активности в сегменты
    let curPoints: TrackPoint[] = [pts[0]]
    let curActivity: TrackActivityType = smoothedActivities[0]
    let confidenceSum = pointVoteConfidence[0] ?? 0
    let confidenceCount = 1

    const flushSegment = () => {
      if (curPoints.length < 2)
        return
      legSegments.push({
        points: curPoints,
        activity: curActivity,
        confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
        features: windowFeatures(curPoints),
      })
    }

    for (let j = 1; j < pts.length; j++) {
      const act = smoothedActivities[j]
      if (act === curActivity) {
        curPoints.push(pts[j])
        confidenceSum += pointVoteConfidence[j] ?? 0
        confidenceCount++
      }
      else {
        flushSegment()
        curPoints = [pts[j - 1], pts[j]] // связываем граничную точку для непрерывности полилинии
        curActivity = act
        confidenceSum = pointVoteConfidence[j] ?? 0
        confidenceCount = 1
      }
    }
    flushSegment()

    // Склейка остатков дробления: без неё маршрут состоял из микро-плеч и «жирных точек» на стыках
    classifiedSegments.push(...consolidateSegments(legSegments))
  }

  // 3. RDP-упрощение геометрии сегментов с сохранением точных кинематических признаков (дистанция, длительность)
  const eps: Record<TrackActivityType, number> = { still: 5, walk: 3, bike: 5, vehicle: 7, rail: 15, unknown: 5 }
  for (const seg of classifiedSegments) {
    seg.points = rdpSimplify(seg.points, eps[seg.activity])
  }

  return classifiedSegments.filter(s => s.points.length > 1)
}

/**
 * Сглаживает ленту активностей: прогоны короче minDwellMs поглощаются соседним,
 * более длинным состоянием. Без этого шага одно «не то» окно рождало отдельный сегмент,
 * и день рассыпался на десятки микро-плеч.
 */
export function smoothActivityRuns<T extends { tsUtc: number }>(
  points: T[],
  activities: TrackActivityType[],
  minDwellMs = MIN_ACTIVITY_DWELL_MS,
): TrackActivityType[] {
  const n = Math.min(points.length, activities.length)
  if (n === 0)
    return []
  const out = activities.slice(0, n)
  if (n < 3)
    return out

  interface ActivityRun { start: number, end: number, activity: TrackActivityType }

  const buildRuns = (): ActivityRun[] => {
    const runs: ActivityRun[] = []
    let start = 0
    for (let i = 1; i <= n; i++) {
      if (i === n || out[i] !== out[start]) {
        runs.push({ start, end: i - 1, activity: out[start] })
        start = i
      }
    }
    return runs
  }
  const durationMs = (r: ActivityRun) => points[r.end].tsUtc - points[r.start].tsUtc

  for (let guard = 0; guard < 64; guard++) {
    const runs = buildRuns()
    if (runs.length <= 1)
      break

    let victim: ActivityRun | null = null
    for (const run of runs) {
      if (durationMs(run) >= minDwellMs)
        continue
      if (!victim || durationMs(run) < durationMs(victim))
        victim = run
    }
    if (!victim)
      break

    const idx = runs.indexOf(victim)
    const prev = idx > 0 ? runs[idx - 1] : null
    const next = idx < runs.length - 1 ? runs[idx + 1] : null
    const donor = !prev ? next! : !next ? prev : (durationMs(prev) >= durationMs(next) ? prev : next)

    for (let i = victim.start; i <= victim.end; i++)
      out[i] = donor.activity
  }

  return out
}

/** Склейка точек двух сегментов без дублирования общей граничной точки. */
function joinTrackPoints(a: TrackPoint[], b: TrackPoint[]): TrackPoint[] {
  const out = [...a]
  const skipShared = out.length > 0 && b.length > 0 && out[out.length - 1].tsUtc === b[0].tsUtc
  out.push(...(skipShared ? b.slice(1) : b))
  return out
}

/**
 * Склеивает сегменты одного плеча: подряд идущие сегменты одной активности объединяются,
 * а микро-сегменты (короче minDwellMs и ближе minDistanceM) поглощаются более длинным соседом.
 * Внутри плеча — чтобы не сшивать куски, разделённые разрывом записи.
 */
export function consolidateSegments(
  segments: TrackSegment[],
  options: { minDwellMs?: number, minDistanceM?: number } = {},
): TrackSegment[] {
  const minDwellMs = options.minDwellMs ?? MIN_ACTIVITY_DWELL_MS
  const minDistanceM = options.minDistanceM ?? MIN_SEGMENT_DISTANCE_M
  if (segments.length === 0)
    return []
  if (segments.length === 1)
    return [...segments]

  const working = segments.map(s => ({ ...s, points: [...s.points] }))
  const spanMs = (s: TrackSegment) => s.points.length > 1
    ? s.points[s.points.length - 1].tsUtc - s.points[0].tsUtc
    : 0

  // 1. Поглощение микро-сегментов более длинным соседом
  let changed = true
  while (changed && working.length > 1) {
    changed = false
    for (let i = 0; i < working.length; i++) {
      const seg = working[i]
      if (spanMs(seg) >= minDwellMs || seg.features.distanceM >= minDistanceM)
        continue

      const prevIdx = i > 0 ? i - 1 : -1
      const nextIdx = i < working.length - 1 ? i + 1 : -1
      if (prevIdx < 0 && nextIdx < 0)
        continue

      const prevDur = prevIdx >= 0 ? spanMs(working[prevIdx]) : -1
      const nextDur = nextIdx >= 0 ? spanMs(working[nextIdx]) : -1
      const donorIdx = prevDur >= nextDur ? prevIdx : nextIdx
      const donor = working[donorIdx]

      const weightDonor = donor.points.length
      const weightSeg = seg.points.length
      donor.points = donorIdx < i
        ? joinTrackPoints(donor.points, seg.points)
        : joinTrackPoints(seg.points, donor.points)
      donor.confidence = (donor.confidence * weightDonor + seg.confidence * weightSeg) / (weightDonor + weightSeg)

      working.splice(i, 1)
      changed = true
      break
    }
  }

  // 2. Склейка соседних сегментов одной активности
  const result: TrackSegment[] = []
  for (const seg of working) {
    const last = result[result.length - 1]
    if (last && last.activity === seg.activity) {
      const weightA = last.points.length
      const weightB = seg.points.length
      last.points = joinTrackPoints(last.points, seg.points)
      last.confidence = (last.confidence * weightA + seg.confidence * weightB) / (weightA + weightB)
      continue
    }
    result.push({ ...seg, points: [...seg.points] })
  }

  return result.map(s => ({ ...s, features: windowFeatures(s.points) }))
}

/**
 * Голос системного Activity Recognition по окну точек: доля уверенности, приходящаяся
 * на доминирующую активность. Это независимый от GPS сигнал (акселерометр), поэтому он
 * остаётся правдивым именно там, где координаты врут: телефон в кармане сидящего
 * человека, велосипед на светофоре, медленная езда в тоннеле.
 */
export function deviceReco(points: TrackPoint[]): RecoHint {
  const weights = new Map<TrackActivityType, number>()
  let total = 0
  for (const p of points) {
    const act = p.deviceActivity
    const conf = p.deviceActivityConfidence ?? 0
    // Ниже порога сигнал не учитываем: Google охотно отдаёт «unknown» и однотипные
    // перескоки с уверенностью 30-45, и они не должны перевешивать геометрию.
    if (!act || act === 'unknown' || conf < DEVICE_ACTIVITY_MIN_CONFIDENCE)
      continue
    weights.set(act, (weights.get(act) ?? 0) + conf)
    total += conf
  }
  if (total <= 0)
    return 'unknown'

  let best: TrackActivityType = 'unknown'
  let bestWeight = 0
  for (const [act, weight] of weights) {
    if (weight > bestWeight) {
      best = act
      bestWeight = weight
    }
  }
  return { activity: best, share: Math.max(0, Math.min(1, bestWeight / total)) }
}

function dominantReco(points: TrackPoint[]): RecoHint {
  // Приоритет — сигналу устройства: он не зависит от точности GPS-фиксов.
  const device = deviceReco(points)
  if (device !== 'unknown')
    return device

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
  return { activity: best, share: points.length > 0 ? n / points.length : 0 }
}
