import { expect, it, vi } from 'vitest'

vi.mock('~/shared/lib/env', () => ({ isMobileApp: false }))
vi.mock('~/shared/services/tracking/track-sync', () => ({ runSync: vi.fn() }))
const { geotrack } = await import('../src/renderer/shared/services/tracking/geotrack-client')
it('clears a GPS timeout after a fresh accepted fix', async () => {
  localStorage.setItem('auth_user', JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }))
  let onPosition!: PositionCallback
  let onError!: PositionErrorCallback
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (position: PositionCallback, error: PositionErrorCallback) => {
        onPosition = position
        onError = error

        return 1
      },
      getCurrentPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  })
  await geotrack.start()

  try {
    onError({
      code: 3,
      TIMEOUT: 3,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      message: 'timeout',
    })
    expect((await geotrack.status()).error).toContain('Таймаут')
    const position = {
      timestamp: Date.now(),
      coords: {
        latitude: 25,
        longitude: 121,
        accuracy: 5,
        speed: 0,
        altitude: null,
        altitudeAccuracy: null,
        toJSON: () => ({}),
        heading: null,
      },
      toJSON: () => ({}),
    }
    onPosition(position)
    expect((await geotrack.status()).error).toBeNull()
    expect((await geotrack.status()).lastSavedTsUtc).toBe(position.timestamp)
  }
  finally { await geotrack.stop() }
})

it('recognizes sustained slow walking in live telemetry once geometry confirms it', async () => {
  localStorage.setItem('auth_user', JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }))
  const base = Date.now() + 1000
  vi.useFakeTimers({ now: base })
  let onPosition!: PositionCallback
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (callback: PositionCallback) => {
        onPosition = callback

        return 1
      },
      getCurrentPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  })

  try {
    await geotrack.start()

    for (let i = 0; i < 24; i++) {
      vi.setSystemTime(base + i * 5000)
      onPosition({
        timestamp: Date.now(),
        coords: {
          latitude: 0,
          longitude: 48 + i * 0.55 * 5 / 111195,
          accuracy: 5,
          speed: 0.55,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          toJSON: () => ({}),
        },
        toJSON: () => ({}),
      })
    }

    expect((await geotrack.status()).telemetry?.activity).toBe('walk')
  }
  finally {
    await geotrack.stop()
    vi.useRealTimers()
  }
})
