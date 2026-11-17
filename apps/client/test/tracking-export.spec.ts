import { expect, it } from 'vitest'
import {
  exportTrackGpx,
  originalTrackView,
} from '../src/renderer/components/04.features/day-track-player/lib/track-export'

const base = {
  clientPointId: 'point-0001',
  sessionId: 'session-1',
  tsUtc: 1000,
  lat: 25,
  lng: 121,
  activity: 'rail' as const,
  recordedActivity: 'walk' as const,
  speed: null,
  accuracy: 5,
}
it('keeps original coordinates/labels separate from edits in exported GPX and never connects separate sessions', () => {
  const raw = [
    base,
    {
      ...base,
      clientPointId: 'point-0002',
      sessionId: 'session-2',
      tsUtc: 2000,
    },
  ]
  const xml = exportTrackGpx('2026-11-17', raw, raw.map(p => ({ ...p, lat: 25.1 })))
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.querySelector('parsererror')).toBeNull()
  expect(doc.querySelectorAll('trk')).toHaveLength(2)
  expect(doc.querySelectorAll('trkseg')).toHaveLength(4)
  expect(doc.querySelector('trk type')?.textContent).toBe('walk')
  expect(doc.querySelectorAll('trk')[1].querySelector('type')?.textContent).toBe('rail')
  expect(doc.querySelectorAll('trk')[1].querySelector('trkpt')?.getAttribute('lat')).toBe('25.1')
})
it('raw mode restores recorded labels for points and routes without changing saved data', () => {
  const source = { points: [base], rawPoints: [base], segments: [] }
  const view = originalTrackView(source)
  expect(view.points[0].activity).toBe('walk')
  expect(view.rawPoints?.[0].activity).toBe('walk')
  expect(view.preparedRenderSegments?.[0].activity).toBe('walk')
  expect(source.points[0].activity).toBe('rail')
})
