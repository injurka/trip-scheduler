import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('~/shared/lib/env', () => ({ isMobileApp: false }))
const { geotrack } = await import('../src/renderer/shared/services/tracking/geotrack-client')
const key = 'tripscheduler_tracking_points:v2:11111111-1111-4111-8111-111111111111'
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
  vi.restoreAllMocks()
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => storage.clear(),
  })
  localStorage.setItem('auth_user', JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }))
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

it('isolates accounts and acknowledges the original account after a switch', async () => {
  const originalOwner = '11111111-1111-4111-8111-111111111111'
  const secondOwner = '22222222-2222-4222-8222-222222222222'
  localStorage.setItem(key, JSON.stringify([point]))
  localStorage.setItem('auth_user', JSON.stringify({ id: secondOwner }))
  expect(await geotrack.getUnsent()).toEqual([])
  await geotrack.markSynced([point.clientPointId], secondOwner)
  expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(1)
  await geotrack.markSynced([point.clientPointId], originalOwner)
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual([])
})
it('retains legacy unowned points without sending them as the current user', async () => {
  localStorage.setItem('tripscheduler_tracking_points', JSON.stringify([point]))
  expect(await geotrack.getUnsent()).toEqual([])
  expect((await geotrack.status()).legacyQueuePreserved).toBe(true)
  expect(JSON.parse(localStorage.getItem('tripscheduler_tracking_points')!)).toEqual([point])
})
