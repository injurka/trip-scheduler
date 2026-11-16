import { describe, expect, it } from 'bun:test'
import { MemorySchema } from '../modules/memory/memory.schemas'

// Use a disposable migrated database; never point this at production.
describe.skipIf(!process.env.MEMORY_CAPTURE_TEST_DATABASE_URL)('memory capture timezone after reload', () => {
  it('preserves capture offsets in every memory response without returning full EXIF', async () => {
    process.env.DATABASE_URL = process.env.MEMORY_CAPTURE_TEST_DATABASE_URL!
    const { db, pool } = await import('../../db')
    const { plans, tripImages, trips, users } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')
    const { memoryRepository } = await import('./memory.repository')
    const [plan] = await db.insert(plans).values({ name: `capture-${crypto.randomUUID()}` }).returning()
    const [user] = await db.insert(users).values({ planId: plan.id }).returning()
    const tripId = crypto.randomUUID()
    await db.insert(trips).values({ id: tripId, title: 'Capture timezone test', userId: user.id, startDate: '2026-11-15', endDate: '2026-11-16' })
    try {
      for (const offset of [480, 0, -300, undefined]) {
        for (const clock of ['09:48', '10:02', '20:30']) {
          const takenAt = new Date(`2026-11-15T${clock}:00.000Z`)
          const [image] = await db.insert(tripImages).values({
            tripId,
            originalName: 'photo.jpg',
            url: 'test/photo.jpg',
            placement: 'memories',
            takenAt,
            metadata: offset === undefined ? null : { timezoneOffset: offset, camera: { model: 'Excluded from list' } },
          }).returning()
          const created = (await memoryRepository.create({ tripId, imageId: image.id }))!
          const reloaded = (await memoryRepository.getByTripId({ tripId })).find(memory => memory.id === created.id)!
          const updated = (await memoryRepository.update({ id: created.id, comment: 'Keep capture time' }))!
          const assigned = (await memoryRepository.applyTakenAtTimestamp(created.id))!
          const unassigned = (await memoryRepository.unassignTimestamp(created.id))!
          for (const response of [created, reloaded, updated, assigned, unassigned]) {
            const output = MemorySchema.parse(response)
            expect(output.image?.takenAt).toEqual(takenAt)
            expect(output.image?.metadata).toEqual(offset === undefined ? {} : { timezoneOffset: offset })
          }
        }
      }
    }
    finally {
      await db.delete(users).where(eq(users.id, user.id))
      await db.delete(plans).where(eq(plans.id, plan.id))
      await pool.end()
    }
  })
})
