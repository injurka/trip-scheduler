import { beforeEach, expect, it, mock } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { trackActivityCorrections } from '../../../db/schema'

let rawRows: unknown[] = []
let correctionRows: unknown[] = []
let queriedParams: unknown[] = []
let correctionInsert: unknown = null

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
  select: () => ({ from: (table: unknown) => ({ where: (filter: Parameters<PgDialect['sqlToQuery']>[0]) => {
    queriedParams = new PgDialect().sqlToQuery(filter).params
    return {
      orderBy: async () => table === trackActivityCorrections ? correctionRows : rawRows,
      limit: async () => rawRows.slice(0, 1),
    }
  } }) }),
  insert: () => ({ values: async (values: unknown) => { correctionInsert = values } }),
  delete: () => ({ where: (filter: Parameters<PgDialect['sqlToQuery']>[0]) => {
    queriedParams = new PgDialect().sqlToQuery(filter).params
    return { returning: async () => [] }
  } }),
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
  rawRows = []
  correctionRows = []
  queriedParams = []
  correctionInsert = null
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

it('rejects corrections without a point owned by the caller and scopes delete by user', async () => {
  await expect(trackingService.correctActivity('owner-a', { sessionId: 'session', startedAt: 1_800_000_000_000, endedAt: 1_800_000_060_000, activity: 'vehicle' })).rejects.toThrow('GPS')
  expect(queriedParams).toContain('owner-a')
  expect(queriedParams).toContain('session')
  expect(correctionInsert).toBeNull()
  expect(await trackingService.removeActivityCorrection('owner-a', 'correction-id')).toEqual({ success: false })
  expect(queriedParams).toContain('owner-a')
  expect(queriedParams).toContain('correction-id')
})

it('stores corrections separately and overlays effective labels when reading an old day', async () => {
  const time = Date.parse('2026-11-10T13:00:00Z')
  rawRows = Array.from({ length: 40 }, (_, i) => ({
    id: `id-${i}`,
    clientPointId: `point-${i}`,
    userId: 'owner',
    sessionId: 'session',
    tsUtc: new Date(time + i * 5_000),
    lat: 0,
    lng: 48 + i * 70 / 111_195,
    speed: 14,
    accuracy: 7,
    altitude: null,
    bearing: null,
    activity: 'walk',
    activityConfidence: 90,
    deviceActivity: 'walk',
    deviceActivityConfidence: 90,
  }))
  const input = { sessionId: 'session', startedAt: time + 20_000, endedAt: time + 80_000, activity: 'bike' as const }
  await trackingService.correctActivity('owner', input)
  expect(correctionInsert).toEqual({ ...input, userId: 'owner', startedAt: new Date(input.startedAt), endedAt: new Date(input.endedAt) })
  correctionRows = [{ ...correctionInsert as object, id: 'correction-id', createdAt: new Date(time) }]
  const day = await trackingService.getDay('owner', { dayUtc: '2026-11-10' })
  expect(day.points[10].activity).toBe('bike')
  expect(day.points[10].activitySource).toBe('manual')
  expect(day.points[10].recordedActivity).toBe('walk')
  expect(day.points[20].activity).toBe('vehicle')
  expect(day.points[20].deviceActivity).toBe('walk')
  expect((rawRows[10] as { activity: string }).activity).toBe('walk')
  correctionRows = []
  expect((await trackingService.getDay('owner', { dayUtc: '2026-11-10' })).points[10].activity).toBe('vehicle')
})
