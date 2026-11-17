export interface TrackQualityPoint {
  samplingIntervalMs?: number | null
  tsUtc: number
  sessionId: string
  accuracy?: number | null
  speed?: number | null
  activity?: string
  deviceActivity?: string | null
  deviceActivityConfidence?: number | null
}
export interface TrackQualityIssue {
  kind: 'pause' | 'accuracy'
  sessionId: string
  startedAt: number
  endedAt: number
  points: number
}

/** Durations use measured edges within one session, never time between recordings. */
export function recordingQuality(points: readonly TrackQualityPoint[], corrections: readonly { id: string }[] = []) {
  const bySession = new Map<string, TrackQualityPoint[]>()
  for (const point of points) {
    const group = bySession.get(point.sessionId) ?? []
    group.push(point)
    bySession.set(point.sessionId, group)
  }
  let gapCount = 0
  let gapDurationMs = 0
  let inaccuratePoints = 0
  let unknownAccuracyPoints = 0
  let durationMs = 0
  let inaccurateDurationMs = 0
  const issues: TrackQualityIssue[] = []
  for (const [sessionId, group] of bySession) {
    const sorted = [...group].sort((a, b) => a.tsUtc - b.tsUtc)
    durationMs += sorted.at(-1)!.tsUtc - sorted[0].tsUtc
    let inaccurate: TrackQualityIssue | undefined
    for (let i = 0; i < sorted.length; i++) {
      const point = sorted[i]
      const previous = sorted[i - 1]
      const gap = previous ? point.tsUtc - previous.tsUtc : 0
      if (gap > Math.max(30_000, (previous?.samplingIntervalMs ?? 3000) > 3000 ? (previous!.samplingIntervalMs! * 2 + 15000) : 30_000)) {
        gapCount++
        gapDurationMs += gap
        issues.push({ kind: 'pause', sessionId, startedAt: previous.tsUtc, endedAt: point.tsUtc, points: 0 })
        inaccurate = undefined
      }
      if (point.accuracy == null)
        unknownAccuracyPoints++
      if (point.accuracy != null && point.accuracy > 35) {
        inaccuratePoints++
        if (!inaccurate) {
          inaccurate = { kind: 'accuracy', sessionId, startedAt: point.tsUtc, endedAt: point.tsUtc, points: 0 }
          issues.push(inaccurate)
        }
        inaccurate.points++
        inaccurate.endedAt = point.tsUtc
        const next = sorted[i + 1]
        if (next && next.tsUtc - point.tsUtc <= 30_000) {
          inaccurateDurationMs += next.tsUtc - point.tsUtc
          inaccurate.endedAt = next.tsUtc
        }
      }
      else {
        inaccurate = undefined
      }
    }
  }
  return {
    gapCount,
    gapDurationMs,
    inaccurateSections: issues.filter(i => i.kind === 'accuracy').length,
    inaccuratePoints,
    unknownAccuracyPoints,
    manualCorrections: new Set(corrections.map(c => c.id)).size,
    durationMs,
    inaccurateDurationMs,
    gapPercent: durationMs ? gapDurationMs / durationMs * 100 : 0,
    inaccuratePercent: durationMs ? inaccurateDurationMs / durationMs * 100 : 0,
    issues: issues.sort((a, b) => a.startedAt - b.startedAt),
  }
}

/** Evidence, rather than a claim that a speed alone proves a transport type. */
export function classificationExplanation(point: TrackQualityPoint, previous?: TrackQualityPoint, next?: TrackQualityPoint): string {
  if ((previous && previous.sessionId !== point.sessionId) || (next && next.sessionId !== point.sessionId))
    return 'Граница отдельных записей. Движение между ними не определяется.'
  if ((previous && point.tsUtc - previous.tsUtc > 30_000) || (next && next.tsUtc - point.tsUtc > 30_000))
    return 'Пауза в записи. Причина отсутствия замеров неизвестна; потеря GPS не подтверждена.'
  if (point.accuracy != null && point.accuracy > 35)
    return 'Низкая точность GPS: смещение может быть вызвано погрешностью координат.'
  if (point.deviceActivity === 'still' && (point.deviceActivityConfidence ?? 0) >= 60 && (point.speed ?? 0) > 2)
    return 'Датчик активности сообщает покой, а GPS — движение. Сигналы противоречат друг другу.'
  if (point.activity && point.activity !== 'unknown')
    return 'Автоматическая оценка по участку маршрута: согласованность координат, скорости и доступных сигналов датчика активности.'
  return 'Недостаточно согласованных замеров для уверенного определения движения. Скорость сама по себе не доказывает тип активности.'
}
