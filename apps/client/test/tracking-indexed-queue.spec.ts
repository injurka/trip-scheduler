import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import { createTrackingQueue } from '../src/renderer/shared/services/tracking/tracking-queue'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('IDBKeyRange', IDBKeyRange)
})
function fixture() {
  const old = new Map<
    string | null,
    Array<{ clientPointId: string, tsUtc: number }>
  >()
  const legacy = {
    read: (owner: string | null) => old.get(owner) ?? [],
    write: (owner: string | null, points: Array<{ clientPointId: string, tsUtc: number }>) => {
      old.set(owner, points)
    },
    snapshot: (owner: string | null) => JSON.stringify(old.get(owner) ?? []),
    clear: (owner: string | null) => {
      old.delete(owner)
    },
  }

  return { old, legacy, queue: createTrackingQueue(legacy) }
}
it('migrates only after committing and keeps account queues independent across reopen', async () => {
  const { old, legacy, queue } = fixture()
  old.set('A', [{ clientPointId: 'shared-id', tsUtc: 1000 }])
  await queue.put('B', [{ clientPointId: 'shared-id', tsUtc: 2000 }])
  expect(await queue.read('A')).toEqual([
    { clientPointId: 'shared-id', tsUtc: 1000 },
  ])
  expect(old.has('A')).toBe(false)
  await queue.remove('A', ['shared-id'])
  const reopened = createTrackingQueue(legacy)
  expect(await reopened.read('A')).toEqual([])
  expect(await reopened.read('B')).toEqual([
    { clientPointId: 'shared-id', tsUtc: 2000 },
  ])
})
it('retains legacy data on a failed transaction and can retry', async () => {
  const { old, queue } = fixture()
  const invalid = {
    clientPointId: 'point-0001',
    tsUtc: 1000,
    uncloneable: () => {},
  }
  old.set('A', [invalid])
  await expect(queue.read('A')).rejects.toBeDefined()
  expect(old.get('A')).toEqual([invalid])
  old.set('A', [{ clientPointId: 'point-0001', tsUtc: 1000 }])
  expect(await queue.read('A')).toHaveLength(1)
})
it('reads a chronological day range and acknowledges only its requested IDs in a large queue', async () => {
  const { queue } = fixture()
  const points = Array.from({ length: 10000 }, (_, index) => ({
    clientPointId: `point-${index}`,
    tsUtc: index + 1000,
  }))
  await queue.put('A', points.reverse())
  expect(await queue.count('A')).toBe(10000)
  expect((await queue.read(
    'A',
    3,
    1500,
    1600,
  )).map(p => p.tsUtc)).toEqual([
    1500,
    1501,
    1502,
  ])
  await queue.remove('A', ['point-500', 'point-501'])
  expect(await queue.count('A')).toBe(9998)
  expect((await queue.read(
    'A',
    1,
    1500,
    1600,
  ))[0].tsUtc).toBe(1502)
}, 30000)
it('can send and acknowledge an existing IndexedDB batch while the next legacy import is failing', async () => {
  const { old, queue } = fixture()
  await queue.put('A', [{ clientPointId: 'existing-001', tsUtc: 1000 }])
  old.set('A', [
    { clientPointId: 'legacy-001', tsUtc: 2000, uncloneable: () => {} } as {
      clientPointId: string
      tsUtc: number
    },
  ])
  expect(await queue.read('A')).toEqual([
    { clientPointId: 'existing-001', tsUtc: 1000 },
  ])
  expect(queue.error('A')).toContain('Исходная очередь сохранена')
  await queue.remove('A', ['existing-001'])
  expect(old.has('A')).toBe(true)
  old.set('A', [{ clientPointId: 'legacy-001', tsUtc: 2000 }])
  expect(await queue.read('A')).toEqual([
    { clientPointId: 'legacy-001', tsUtc: 2000 },
  ])
  expect(queue.error('A')).toBeNull()
})
