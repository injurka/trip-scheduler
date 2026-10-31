import { describe, expect, it } from 'bun:test'
import { buildContentDisposition } from './content-disposition'

describe('buildContentDisposition', () => {
  it('keeps plain ASCII file names readable', () => {
    expect(buildContentDisposition('inline', 'trip_japan.ics'))
      .toBe('inline; filename="trip_japan.ics"; filename*=UTF-8\'\'trip_japan.ics')
  })

  it('produces a Latin-1 safe header for Cyrillic and emoji titles', () => {
    const header = buildContentDisposition('inline', 'trip_Япония 🎌 (2026).ics')

    expect(/^[\x20-\x7E]+$/.test(header)).toBe(true)
    expect(header).toContain('filename*=UTF-8\'\'trip_%D0%AF%D0%BF')
    expect(() => new Response('x', { headers: { 'Content-Disposition': header } })).not.toThrow()
  })

  it('falls back to a generic name when nothing ASCII is left', () => {
    expect(buildContentDisposition('attachment', 'Япония')).toContain('filename="file"')
  })
})
