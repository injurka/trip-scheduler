import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'bun:test'

it('CLI links activity descriptions to private uploaded documents', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'document-links-cli-'))
  const activities: any[] = []
  const uploads: any[] = []
  const id = '00000000-0000-4000-8000-000000000001'
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/auth/signin')
      return Response.json({ token: { accessToken: 'test-token' }, user: {} })
    if (path === '/api/upload') {
      const form = await request.formData()
      uploads.push(JSON.parse(String(form.get('metadata'))))
      return Response.json({ url: `trips/${id}/documents/voucher.pdf` })
    }
    if (request.method === 'GET')
      return Response.json(path.includes('details') ? { sections: [] } : [])
    const body = await request.json() as any
    if (path === '/activities')
      activities.push(body)
    return Response.json({ ...body, id })
  } })
  try {
    const folder = '00 - Файлы и документы/PrivateDocument/Транспорт'
    mkdirSync(join(directory, folder), { recursive: true })
    mkdirSync(join(directory, '02 - Маршрутный план'))
    writeFileSync(join(directory, folder, 'Voucher.pdf'), '%PDF-test')
    writeFileSync(join(directory, 'Trip.md'), '# Trip\n\n## Краткое описание\n\nDocument links test.')
    writeFileSync(join(directory, '02 - Маршрутный план/01 Arrival.md'), `* **14:15 - 15:30** — Прилет:\n  * Документы: [[${folder}/Voucher.pdf|Ваучер с QR-кодом]]. Баланс 200 TWD.`)
    const child = Bun.spawn([process.execPath, new URL('../run.ts', import.meta.url).pathname, '--yes', '--no-llm', '--no-images', '--no-geo', '--dir', directory, '--start-date', '2026-11-04', '--api-url', server.url.href, '--email', 'test@example.test', '--password', 'test-password'], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect({ code, errors: code ? stdout + stderr : '' }).toEqual({ code: 0, errors: '' })
    expect(uploads).toHaveLength(1)
    expect(uploads[0].access).toBe('private')
    const description = activities[0].sections.find((section: any) => section.type === 'description').text
    expect(description).toContain(`[Ваучер с QR-кодом](#trip-document=${encodeURIComponent(`trips/${id}/documents/voucher.pdf`)})`)
    expect(description).toContain('Баланс 200 TWD.')
    expect(description).not.toContain('test-token')
  }
  finally {
    server.stop(true)
    rmSync(directory, { recursive: true, force: true })
  }
}, 15000)
