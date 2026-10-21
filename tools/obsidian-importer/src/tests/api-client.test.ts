import { afterEach, describe, expect, it } from 'bun:test'
import { ApiClient, ApiHttpError } from '../lib/api-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const transitActivity = {
  dayId: 'day-1',
  title: 'Автобус до Hinoki Village',
  startTime: '14:50',
  endTime: '15:20',
  tag: 'transport',
  sections: [{
    id: 'geo-1',
    type: 'geolocation',
    title: 'Chiayi Station → Hinoki Village',
    points: [],
    routes: [{
      id: 'route-1',
      title: 'Chiayi Station → Hinoki Village',
      points: [],
      transportMode: 'transit',
      isVisible: true,
    }],
  }],
}

describe('ApiClient activity validation', () => {
  it('retries transit routes as car when an older API rejects the mode', async () => {
    const bodies: any[] = []
    const warnings: string[] = []

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      if (bodies.length === 1) {
        return jsonResponse({
          message: 'Input validation failed',
          code: 'BAD_REQUEST',
          issues: [{
            path: ['sections', 0, 'routes', 0, 'transportMode'],
            message: 'Invalid option: expected one of "foot"|"bike"|"car"',
            code: 'invalid_value',
          }],
        }, 400)
      }
      return jsonResponse({ id: 'activity-1' })
    }) as typeof fetch

    const client = new ApiClient('http://api.test', { onWarning: message => warnings.push(message) })
    const result = await client.createActivity(transitActivity)

    expect(result).toEqual({ id: 'activity-1' })
    expect(bodies).toHaveLength(2)
    expect(bodies[0].sections[0].routes[0].transportMode).toBe('transit')
    expect(bodies[1].sections[0].routes[0].transportMode).toBe('car')
    expect(warnings).toHaveLength(1)
  })

  it('keeps the original payload when the API accepts transit', async () => {
    const bodies: any[] = []
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return jsonResponse({ id: 'activity-1' })
    }) as typeof fetch

    const client = new ApiClient('http://api.test')
    await client.createActivity(transitActivity)

    expect(bodies).toHaveLength(1)
    expect(bodies[0].sections[0].routes[0].transportMode).toBe('transit')
  })

  it('does not retry unrelated validation errors and exposes the issue path', async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      return jsonResponse({
        message: 'Input validation failed',
        code: 'BAD_REQUEST',
        issues: [{ path: ['title'], message: 'Too big: expected string to have <=10 characters', code: 'too_big' }],
      }, 400)
    }) as unknown as typeof fetch

    const client = new ApiClient('http://api.test')

    try {
      await client.createActivity(transitActivity)
      throw new Error('expected createActivity to fail')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ApiHttpError)
      expect((error as ApiHttpError).status).toBe(400)
      expect((error as Error).message).toContain('title: Too big')
    }
    expect(calls).toBe(1)
  })
})
