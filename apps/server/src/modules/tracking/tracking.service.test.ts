import { beforeEach, expect, it, mock } from 'bun:test'

let confirmed: { clientPointId: string }[] = []
let failWrite = false
let failCommit = false
const transaction = {
  insert: () => ({ values: () => ({ onConflictDoNothing: async () => {
    if (failWrite)
      throw new Error('write failed')
  } }) }),
  select: () => ({ from: () => ({ where: async () => confirmed }) }),
}
mock.module('../../../db', () => ({ db: {
  transaction: async (fn: (tx: typeof transaction) => Promise<unknown>) => {
    const result = await fn(transaction)
    if (failCommit)
      throw new Error('commit failed')
    return result
  },
  select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [] }) }) }),
} }))
mock.module('../../lib/db-monitoring', () => ({ measureDbQuery: async (_table: string, _op: string, fn: () => Promise<unknown>) => fn() }))
const { trackingService } = await import('./tracking.service')
const points = ['point-0001', 'point-0002'].map(clientPointId => ({
  clientPointId,
  sessionId: 'session',
  tsUtc: Date.now(),
  lat: 55,
  lng: 48,
  altitude: null,
  accuracy: 5,
  speed: 0,
  bearing: null,
  activity: 'still' as const,
  activityConfidence: 90,
}))
beforeEach(() => {
  confirmed = []
  failWrite = false
  failCommit = false
})
it('acknowledges persisted IDs again on a retry', async () => {
  confirmed = points.map(point => ({ clientPointId: point.clientPointId }))
  const first = await trackingService.ingestBatch('user', { points })
  const retry = await trackingService.ingestBatch('user', { points })
  expect(first.accepted).toEqual(['point-0001', 'point-0002'])
  expect(retry).toEqual(first)
})
it('does not acknowledge IDs missing from user-owned rows', async () => {
  confirmed = [{ clientPointId: 'point-0001' }]
  expect(await trackingService.ingestBatch('user', { points })).toEqual({ accepted: ['point-0001'], rejectedCount: 1 })
})
it('fails the request on a database write or commit failure', async () => {
  failWrite = true
  await expect(trackingService.ingestBatch('user', { points })).rejects.toThrow('write failed')
  failWrite = false
  failCommit = true
  await expect(trackingService.ingestBatch('user', { points })).rejects.toThrow('commit failed')
})
