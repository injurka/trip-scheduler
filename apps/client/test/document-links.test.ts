import { describe, expect, it } from 'bun:test'
import { getDocumentLinkPath } from '../src/renderer/shared/lib/document-link'

describe('document link targets', () => {
  it('resolves a stored path without adding credentials', () => {
    const path = 'trips/trip-1/documents/file.pdf'
    expect(getDocumentLinkPath(`#trip-document=${encodeURIComponent(path)}`)).toBe(path)
  })

  it('rejects external, malformed and traversing targets', () => {
    for (const path of ['https://example.com/file.pdf', 'javascript:alert(1)', 'trips/a/documents/../../secret', 'trips/a/documents/file?token=secret'])
      expect(getDocumentLinkPath(`#trip-document=${encodeURIComponent(path)}`)).toBeNull()

    expect(getDocumentLinkPath('#trip-document=%ZZ')).toBeNull()
    expect(getDocumentLinkPath('https://example.com')).toBeNull()
  })
})
