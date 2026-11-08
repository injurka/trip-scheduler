import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('~/shared/lib/env', () => ({ isMobileApp: false }))
const { geotrack } = await import('../src/renderer/shared/services/tracking/geotrack-client')
const key = 'tripscheduler_tracking_points'
const point = {
  clientPointId: 'point-000000',
  tsUtc: Date.now(),
  lat: 55,
  lng: 48,
  altitude: null,
  accuracy: 5,
  speed: 0,
  bearing: null,
  activity: 'still',
  activityConfidence: 90,
  sessionId: 'session',
}
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
it('keeps more than 5000 unconfirmed points when acknowledging a subset', async () => {
  localStorage.setItem(key, JSON.stringify(Array.from({ length: 6000 }, (_, i) => ({ ...point, clientPointId: `point-${String(i).padStart(6, '0')}` }))))
  await geotrack.markSynced(['point-000000'])
  expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(5999)
  expect((await geotrack.getUnsent(6000))[0]?.clientPointId).toBe('point-000001')
})
it('preserves damaged queue data and reports the problem', async () => {
  localStorage.setItem(key, '[{"broken":true}]')
  await expect(geotrack.getUnsent()).rejects.toThrow('некорректные')
  expect(localStorage.getItem(key)).toBe('[{"broken":true}]')
})
it('rejects acknowledgement if durable storage fails', async () => {
  localStorage.setItem(key, JSON.stringify([point]))
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError')
  })
  await expect(geotrack.markSynced([point.clientPointId])).rejects.toThrow('QuotaExceededError')
  expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(1)
})
