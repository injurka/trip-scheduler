import type { DayData, DayPoint } from '../src/renderer/components/04.features/day-track-player/models/types'
import { describe, expect, it } from 'vitest'
import { useTrackCorrectionDrafts } from '../src/renderer/components/04.features/day-track-player/composables/use-track-correction-drafts'

const start = Date.parse('2026-11-12T10:00:00Z')
const points: DayPoint[] = Array.from({ length: 100 }, (_, i) => ({
  clientPointId: `p-${i}`,
  sessionId: 'test-session',
  tsUtc: start + i * 5000,
  lat: 0,
  lng: 30 + i * 7 / 111195,
  accuracy: 5,
  speed: 1.4,
  activity: 'walk',
  recordedActivity: 'walk',
}))
const data: DayData = { points, rawPoints: points, segments: [], corrections: [] }
const choice = { sessionId: 'test-session', startedAt: start, endedAt: start + 400000, activity: 'vehicle' as const }

describe('local correction queue', () => {
  it('previews latest overlapping choices without mutating the loaded measurements', () => {
    const drafts = useTrackCorrectionDrafts()
    const copy = structuredClone(data)
    drafts.stage(choice, data)
    drafts.stage({ ...choice, startedAt: start + 100000, endedAt: start + 200000, activity: 'bike' }, data)
    const preview = drafts.preview(data)
    expect(preview.rawPoints?.[10].activity).toBe('vehicle')
    expect(preview.rawPoints?.[30].activity).toBe('bike')
    expect(preview.rawPoints?.[60].activity).toBe('vehicle')
    expect(data).toEqual(copy)
    drafts.clear()
    expect(drafts.preview(data)).toBe(data)
  })
  it('replaces an exact interval, giving the replacement the latest priority', () => {
    const drafts = useTrackCorrectionDrafts()
    drafts.stage(choice, data)
    drafts.stage({ ...choice, activity: 'rail' }, data)
    expect(drafts.count.value).toBe(1)
    expect(drafts.preview(data).rawPoints?.[10].activity).toBe('rail')
    drafts.remove(drafts.additions.value[0].id)
    expect(drafts.count.value).toBe(0)
  })
  it('previews removal of a persisted correction and keeps it reversible', () => {
    const existing = { ...choice, id: 'persisted', createdAt: 1 }
    const base = { ...data, corrections: [existing] }
    const drafts = useTrackCorrectionDrafts()
    drafts.remove(existing.id)
    drafts.remove(existing.id)
    expect(drafts.count.value).toBe(1)
    expect(drafts.preview(base).corrections).toEqual([])
    expect(drafts.preview(base).rawPoints?.[10].activity).toBe('walk')
    drafts.clear()
    expect(drafts.preview(base).corrections).toEqual([existing])
  })
  it('cleans up a replaced draft even if a timed-out request may have saved its previous ID', () => {
    const drafts = useTrackCorrectionDrafts()
    drafts.stage(choice, data)
    const submittedId = drafts.additions.value[0].id
    drafts.markSubmitted()
    drafts.stage({ ...choice, activity: 'bike' }, data)
    expect(drafts.removals.value).toEqual([submittedId])
    expect(drafts.additions.value[0].id).not.toBe(submittedId)
    drafts.markSubmitted()
    const replacement = drafts.additions.value[0].id
    drafts.remove(replacement)
    expect(drafts.additions.value).toEqual([])
    expect(drafts.removals.value).toEqual([submittedId, replacement])
  })
})
