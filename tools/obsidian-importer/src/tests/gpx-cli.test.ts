import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'bun:test'

it('imports a GPX route through the CLI, even with images and geocoding disabled', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gpx-cli-'))
  const activities: any[] = []
  const id = '00000000-0000-4000-8000-000000000001'
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/auth/signin')
        return Response.json({ token: { accessToken: 'test-token' }, user: {} })
      if (path === '/geo/places/resolve')
        return Response.json({ status: 'resolved', place: { id: '00000000-0000-4000-8000-000000000002', name: 'Walk' } })
      if (request.method === 'GET')
        return Response.json(path.includes('details') ? { sections: [] } : [])
      const body = await request.json() as any
      if (path === '/activities')
        activities.push(body)
      return Response.json({ ...body, id })
    },
  })
  try {
    mkdirSync(join(directory, '02 - Маршрутный план'))
    const gpxDir = join(directory, '00 - Файлы и документы/PublicDocument/Маршруты GPS')
    mkdirSync(gpxDir, { recursive: true })
    writeFileSync(join(directory, 'Trip.md'), '# Trip\n\n## Краткое описание\n\nCLI GPX test.')
    writeFileSync(join(directory, '02 - Маршрутный план/01 Walk.md'), `# День 01

* **09:00 - 10:00** — Прогулка:
    * Идём по тропе.
    * _GPX-трек_: [[walk.gpx|Тропа]]
`)
    writeFileSync(join(gpxDir, 'walk.gpx'), '<gpx><wpt lat="25.005" lon="121.005"><name>Peak</name></wpt><trk><name>Walk</name><trkseg><trkpt lat="25" lon="121"/><trkpt lat="25.01" lon="121.01"/></trkseg></trk></gpx>')
    const child = Bun.spawn([
      process.execPath,
      new URL('../run.ts', import.meta.url).pathname,
      '--yes',
      '--no-llm',
      '--no-images',
      '--no-documents',
      '--no-geo',
      '--dir',
      directory,
      '--start-date',
      '2026-11-04',
      '--api-url',
      server.url.href,
      '--email',
      'gpx@example.test',
      '--password',
      'test-password',
    ], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ code, errors: code ? stdout + stderr : '' }).toEqual({ code: 0, errors: '' })
    expect(activities).toHaveLength(1)
    const geo = activities[0].sections.find((section: any) => section.type === 'geolocation')
    expect(geo?.routes).toHaveLength(1)
    expect(geo.routes[0]).toMatchObject({ title: 'Тропа', transportMode: 'foot', isVisible: true })
    expect(geo.routes[0].geometry).toEqual([[121, 25], [121.01, 25.01]])
    expect(geo.routes[0].points.map((point: any) => [point.address, point.type])).toEqual([
      ['Начало трека', 'start'],
      ['Peak', 'via'],
      ['Конец трека', 'end'],
    ])
  }
  finally {
    server.stop(true)
    rmSync(directory, { recursive: true, force: true })
  }
}, 15000)
