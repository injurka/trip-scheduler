import { describe, expect, it } from 'bun:test'
import { parseDocumentFolders } from './document-folders'

describe('document folder persistence contract', () => {
  it('retains legacy roots and unrelated fields', () => {
    expect(parseDocumentFolders({ folders: [{ id: 'a', name: 'Билеты' }], custom: 42 })).toEqual({ folders: [{ id: 'a', name: 'Билеты', parentId: null }], custom: 42 })
  })
  it('rejects cycles, foreign parents and duplicate IDs', () => {
    for (const folders of [
      [{ id: 'a', name: 'A', parentId: 'a' }],
      [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }],
      [{ id: 'a', name: 'A', parentId: 'foreign-trip' }],
      [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }],
    ]) expect(() => parseDocumentFolders({ folders })).toThrow()
  })
  it('preserves nesting for old clients, allows explicit root moves', () => {
    const previous = { folders: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', parentId: 'a' }] }
    expect(parseDocumentFolders({ folders: [{ id: 'a', name: 'A' }, { id: 'b', name: 'Renamed' }] }, previous).folders[1].parentId).toBe('a')
    expect(parseDocumentFolders({ folders: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', parentId: null }] }, previous).folders[1].parentId).toBeNull()
  })
})
