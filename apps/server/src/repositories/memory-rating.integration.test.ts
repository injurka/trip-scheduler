import { describe, expect, it } from 'bun:test'

// Run against a disposable, migrated database only, in a separate Bun process.
describe.skipIf(!process.env.PHOTO_RATING_TEST_DATABASE_URL)('photo rating persistence', () => {
  it('imports stars, preserves manual values and clearing, and serializes creation with extraction', async () => {
    process.env.DATABASE_URL = process.env.PHOTO_RATING_TEST_DATABASE_URL!
    const { db, pool } = await import('../../db')
    const { memories, plans, tripImages, trips, users } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')
    const { memoryRepository, applyImportedImageRating } = await import('./memory.repository')
    const connection = await pool.connect()
    try {
      await connection.query('BEGIN')
      await connection.query('CREATE TEMP TABLE memories (rating integer) ON COMMIT DROP')
      await connection.query('INSERT INTO memories (rating) VALUES (NULL), (3)')
      await connection.query(await Bun.file('drizzle/0024_conscious_colonel_america.sql').text())
      expect((await connection.query('SELECT rating_manually_set FROM memories')).rows.every(row => row.rating_manually_set)).toBe(true)
      await connection.query('INSERT INTO memories DEFAULT VALUES')
      expect((await connection.query('SELECT rating_manually_set FROM memories')).rows.at(-1)?.rating_manually_set).toBe(false)
    }
    finally {
      await connection.query('ROLLBACK')
      connection.release()
    }
    const [plan] = await db.insert(plans).values({ name: `ratings-${crypto.randomUUID()}` }).returning()
    const [user] = await db.insert(users).values({ planId: plan.id }).returning()
    const tripId = crypto.randomUUID()
    await db.insert(trips).values({ id: tripId, title: 'Rating test', userId: user.id, startDate: '2026-11-11', endDate: '2026-11-11' })
    try {
      const [image] = await db.insert(tripImages).values({ tripId, originalName: 'photo.jpg', url: 'test/photo.jpg', placement: 'memories', metadata: { rating: 4 } }).returning()
      const auto = (await memoryRepository.create({ tripId, imageId: image.id }))!
      expect(auto.rating).toBe(4)
      const manual = (await memoryRepository.create({ tripId, imageId: image.id, rating: 2 }))!
      await memoryRepository.update({ id: auto.id, rating: null })
      await applyImportedImageRating(db, image.id, 5)
      expect((await db.query.memories.findFirst({ where: eq(memories.id, auto.id) }))?.rating).toBeNull()
      expect((await db.query.memories.findFirst({ where: eq(memories.id, manual.id) }))?.rating).toBe(2)

      const [pending] = await db.insert(tripImages).values({ tripId, originalName: 'pending.jpg', url: 'test/pending.jpg', placement: 'memories' }).returning()
      const early = (await memoryRepository.create({ tripId, imageId: pending.id }))!
      expect(early.rating).toBeNull()
      await memoryRepository.update({ id: early.id, comment: 'Keep comment' })
      await applyImportedImageRating(db, pending.id, 3)
      expect((await db.query.memories.findFirst({ where: eq(memories.id, early.id) }))?.rating).toBe(3)

      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let locked!: () => void
      const ready = new Promise<void>((resolve) => {
        locked = resolve
      })
      const extraction = db.transaction(async (tx) => {
        await tx.select().from(tripImages).where(eq(tripImages.id, pending.id)).for('update')
        locked()
        await gate
        await tx.update(tripImages).set({ metadata: { rating: 5 } }).where(eq(tripImages.id, pending.id))
        await applyImportedImageRating(tx, pending.id, 5)
      })
      await ready
      const creation = memoryRepository.create({ tripId, imageId: pending.id })
      release()
      await extraction
      expect((await creation)?.rating).toBe(5)
    }
    finally {
      await db.delete(users).where(eq(users.id, user.id))
      await db.delete(plans).where(eq(plans.id, plan.id))
      await pool.end()
    }
  })
})
