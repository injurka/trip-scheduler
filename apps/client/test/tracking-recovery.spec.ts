import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const ownerId = '11111111-1111-4111-8111-111111111111'
const m = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  running: true,
  failHealth: false,
  owner: '',
  session: 'native-session-existing',
  startedAt: 0,
  buffer: [] as unknown[],
}))
vi.mock('~/shared/lib/env', () => ({ isMobileApp: true }))
vi.mock('~/shared/services/tracking/track-sync', () => ({
  runSync: async () => 0,
}))
vi.mock('@tauri-apps/plugin-geolocation', () => ({
  checkPermissions: async () => ({
    location: 'granted',
    coarseLocation: 'granted',
  }),
  requestPermissions: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({
  addPluginListener: m.listen,
  invoke: m.invoke,
}))
let geotrack: typeof import('../src/renderer/shared/services/tracking/geotrack-client').geotrack
const queueKey = `tripscheduler_tracking_points:v2:${ownerId}`
const sessionKey = `tripscheduler_tracking_session:v2:${ownerId}`
function nativePoint() {
  return {
    ownerId,
    sessionId: m.session,
    clientPointId: 'native-point-0001',
    timestamp: Date.now(),
    latitude: 25,
    longitude: 121.0001,
    accuracy: 5,
    speed: 1,
  }
}
beforeEach(async () => {
  vi.resetModules()
  vi.restoreAllMocks()
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  })
  localStorage.setItem('auth_user', JSON.stringify({ id: ownerId }))
  m.running = true
  m.failHealth = false
  m.owner = ownerId
  m.startedAt = Date.now() - 3600000
  m.buffer = []
  m.listen.mockReset().mockResolvedValue({ unregister: async () => {} })
  m.invoke.mockReset().mockImplementation(async (command: string) => {
    if (command === 'tracking_is_running')
      return m.running

    if (command === 'tracking_check_permissions') {
      if (m.failHealth)
        throw new Error('transient plugin error')

      return {
        ownerId: m.owner,
        sessionId: m.session,
        sessionStartedAt: m.startedAt,
        location: true,
        notifications: true,
        activityRecognition: true,
        batteryOptimizationsIgnored: true,
      }
    }

    if (command === 'tracking_start')
      m.running = true

    if (command === 'tracking_stop')
      m.running = false

    if (command === 'tracking_get_buffered')
      return m.buffer

    if (command === 'tracking_ack_buffered')
      m.buffer = []

    return true
  })
})
afterEach(async () => {
  m.failHealth = false
  m.buffer = []

  if (geotrack)
    await geotrack.stop()
})
async function load() {
  geotrack = (
    await import('../src/renderer/shared/services/tracking/geotrack-client')
  ).geotrack
}
function called(command: string) {
  return m.invoke.mock.calls.some(([name]) => name === command)
}
it('attaches to the native recording with its session and start time without START', async () => {
  m.buffer = [nativePoint()]
  await load()
  const status = await geotrack.status()
  expect(status.running).toBe(true)
  expect(status.telemetry?.durationMs).toBeGreaterThanOrEqual(3600000)
  expect(status.lastFixTsUtc).toBe((await geotrack.getUnsent())[0].tsUtc)
  expect(JSON.parse(localStorage.getItem(sessionKey)!)).toMatchObject({
    sessionId: m.session,
    startedAt: m.startedAt,
  })
  expect(JSON.parse(localStorage.getItem(sessionKey)!).lastPoint.clientPointId).toBe('native-point-0001')
  expect(called('tracking_start')).toBe(false)
  const listeners = m.listen.mock.calls.length
  await geotrack.status()
  expect(m.listen.mock.calls.length).toBe(listeners)
})
it('explicit Start also attaches to an existing same-owner native session', async () => {
  await load()
  expect((await geotrack.start()).running).toBe(true)
  expect(called('tracking_start')).toBe(false)
  expect(JSON.parse(localStorage.getItem(sessionKey)!)).toMatchObject({
    sessionId: m.session,
  })
})
it('reconciles an old saved JS session with the active native session', async () => {
  localStorage.setItem(sessionKey, JSON.stringify({
    sessionId: 'stale-js-session',
    startedAt: Date.now(),
    distanceM: 100,
    lastPoint: null,
    isRunning: true,
  }))
  await load()
  await vi.waitFor(async () =>
    expect((await geotrack.status()).transitioning).toBe(false))
  expect(JSON.parse(localStorage.getItem(sessionKey)!)).toMatchObject({
    sessionId: m.session,
    startedAt: m.startedAt,
    distanceM: 0,
  })
  expect(called('tracking_start')).toBe(false)
})
it('does not stop an active service during a transient health failure and clears the warning on recovery', async () => {
  await load()
  await geotrack.status()
  m.invoke.mockClear()
  m.failHealth = true
  const status = await geotrack.status()
  expect(status.running).toBe(true)
  expect(status.error).toContain('статус GPS-сервиса')
  expect(called('tracking_stop')).toBe(false)
  m.failHealth = false
  expect((await geotrack.status()).error).toBeNull()
  expect(called('tracking_start')).toBe(false)
})
it('still stops a confirmed foreign-owner service', async () => {
  m.owner = 'other-account'
  await load()
  expect((await geotrack.status()).running).toBe(false)
  expect(called('tracking_stop')).toBe(true)
  expect(called('tracking_start')).toBe(false)
})
it('uploads the existing durable queue despite quota, then imports the native batch without loss', async () => {
  m.running = false
  const existing = {
    clientPointId: 'existing-point-0001',
    sessionId: 'existing-session',
    tsUtc: Date.now() - 10000,
    lat: 25,
    lng: 121,
    accuracy: 5,
    speed: 1,
    altitude: null,
    bearing: null,
    activity: 'walk',
    activityConfidence: 90,
  }
  localStorage.setItem(queueKey, JSON.stringify([existing]))
  m.buffer = [nativePoint()]
  await load()
  vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
    throw new Error('QuotaExceededError')
  })
  expect(await geotrack.getUnsent()).toMatchObject([existing])
  expect(called('tracking_ack_buffered')).toBe(false)
  await geotrack.markSynced([existing.clientPointId])
  expect(JSON.parse(localStorage.getItem(queueKey)!)).toEqual([])
  expect((await geotrack.getUnsent()).map(p => p.clientPointId)).toEqual([
    'native-point-0001',
  ])
  expect(called('tracking_ack_buffered')).toBe(true)
  expect((await geotrack.getUnsent()).map(p => p.clientPointId)).toEqual([
    'native-point-0001',
  ])
})
