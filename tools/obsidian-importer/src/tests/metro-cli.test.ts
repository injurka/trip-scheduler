import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import taipei from '../../../metro-import/data/taipei.json'

for (const audit of [false, true]) {
  test(`CLI ${audit ? 'audits without writes' : 'persists metro in city mode'}`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'metro-cli-'))
    const activities: any[] = []
    const requests: string[] = []
    let sequence = 0
    const server = Bun.serve({ port: 0, fetch: async (request) => {
      const path = new URL(request.url).pathname
      requests.push(`${request.method} ${path}`)
      if (path === '/metro/systems')
        return Response.json([{ id: taipei.id, city: taipei.city }])
      if (path === '/metro/systems/tw-taipei')
        return Response.json(taipei)
      if (path === '/auth/signin')
        return Response.json({ token: { accessToken: 'test-token' }, user: {} })
      if (request.method === 'GET')
        return Response.json(path.includes('details') ? { sections: [] } : [])
      const body = await request.json() as any
      if (path === '/activities')
        activities.push(body)
      return Response.json({ ...body, id: `id-${++sequence}` })
    } })
    try {
      mkdirSync(join(directory, '02 - Маршрутный план'))
      writeFileSync(join(directory, 'Trip.md'), '# Trip\n\n## Краткое описание\n\nMetro CLI test.')
      writeFileSync(join(directory, '02 - Маршрутный план/01 Taipei.md'), `---
location: Тайбэй
---
# День 01

* **09:00 - 09:30** — Метро:
\`\`\`transport
type: metro
routes:
  - from: Ximen (G12)
    to: Beimen (G13)
    line: Songshan–Xindian Line
    code: G
\`\`\`
`)
      const child = Bun.spawn([process.execPath, new URL('../run.ts', import.meta.url).pathname, '--yes', '--no-llm', '--no-images', '--no-documents', '--no-geo', ...(audit ? ['--check-metro'] : []), '--dir', directory, '--start-date', '2026-11-04', '--api-url', server.url.href, '--email', 'test@example.test', '--password', 'test-password'], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect({ code, errors: code ? stdout + stderr : '' }).toEqual({ code: 0, errors: '' })
      if (audit) {
        expect(requests.every(request => request.startsWith('GET '))).toBe(true)
        expect(stdout).toContain('1/1 блоков')
      }
      else {
        expect(activities).toHaveLength(1)
        const section = activities[0].sections.find((section: any) => section.type === 'metro')
        expect(section).toMatchObject({ mode: 'city', systemId: 'tw-taipei' })
        expect(section.rides[0]).toMatchObject({ lineId: 'tw-taipei-g', startStationId: 'tw-taipei-g12', endStationId: 'tw-taipei-g13', stops: 1 })
      }
    }
    finally {
      server.stop(true)
      rmSync(directory, { recursive: true, force: true })
    }
  }, 15000)
}
