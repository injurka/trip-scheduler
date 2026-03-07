import type { z } from 'zod'
import type { CreateMarkInputSchema, GetMarksInputSchema } from './mark.schemas'
import { and, gte, lte } from 'drizzle-orm'
import { db } from '~/../db'
import { marks } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'
import { createTRPCError } from '~/lib/trpc'

export const markService = {
  async getMarks(params: z.infer<typeof GetMarksInputSchema>) {
    return measureDbQuery('marks', 'select', async () => {
      const { screen } = params

      const minLat = Math.min(screen.leftTop.lat, screen.rightBottom.lat)
      const maxLat = Math.max(screen.leftTop.lat, screen.rightBottom.lat)
      const minLon = Math.min(screen.leftTop.lon, screen.rightBottom.lon)
      const maxLon = Math.max(screen.leftTop.lon, screen.rightBottom.lon)

      const foundMarks = await db.query.marks.findMany({
        where: and(
          gte(marks.latitude, minLat),
          lte(marks.latitude, maxLat),
          gte(marks.longitude, minLon),
          lte(marks.longitude, maxLon),
        ),
        with: {
          user: {
            columns: { id: true, name: true, avatarUrl: true },
          },
        },
        limit: 500,
      })

      return foundMarks.map((mark) => {
        let endAtDate: Date | undefined
        let isEnded = false
        const now = new Date()

        if (mark.startAt && mark.duration && mark.duration > 0) {
          endAtDate = new Date(mark.startAt)
          endAtDate.setHours(endAtDate.getHours() + mark.duration)
          isEnded = now > endAtDate
        }

        return {
          id: mark.id,
          markName: mark.title,
          ownerId: mark.userId,
          geom: {
            type: 'Point',
            bbox: null,
            coordinates: [mark.longitude, mark.latitude],
          },
          startAt: mark.startAt?.toISOString(),
          endAt: endAtDate?.toISOString(),
          duration: mark.duration,
          isEnded,
          category: {
            id: mark.categoryId,
            categoryName: mark.duration === 0 ? 'Место' : 'Событие',
            color: mark.duration === 0 ? '#10B981' : '#3B82F6',
            icon: 'mdi:map-marker',
          },
          additionalInfo: mark.description || undefined,
          photo: [],
          owner: mark.user
            ? {
              id: mark.user.id,
              username: mark.user.name || 'Аноним',
              avatar: mark.user.avatarUrl || undefined,
            }
            : undefined,
        }
      })
    })
  },

  async create(data: z.infer<typeof CreateMarkInputSchema>, userId: string) {
    return measureDbQuery('marks', 'insert', async () => {
      const [newMark] = await db.insert(marks).values({
        userId,
        title: data.markName,
        description: data.additionalInfo,
        latitude: data.latitude,
        longitude: data.longitude,
        categoryId: data.categoryId,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        duration: data.duration,
      }).returning()

      if (!newMark) {
        throw createTRPCError('INTERNAL_SERVER_ERROR', 'Не удалось создать метку')
      }

      return {
        id: newMark.id,
        markName: newMark.title,
        ownerId: newMark.userId,
        geom: { type: 'Point', bbox: null, coordinates: [newMark.longitude, newMark.latitude] },
        startAt: newMark.startAt?.toISOString(),
        duration: newMark.duration,
        isEnded: false,
        category: { id: newMark.categoryId, categoryName: 'Событие', color: '#3B82F6', icon: '' },
        additionalInfo: newMark.description || undefined,
      }
    })
  },
}
