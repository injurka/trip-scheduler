import type { z } from 'zod'
import type { ImportMetroSystemInputSchema } from '~/modules/metro/metro.schemas'
import { eq } from 'drizzle-orm'
import { db } from '~/../db'
import { metroLines, metroLineStations, metroStations, metroSystems } from '~/../db/schema'

export const metroRepository = {
  async findSystems() {
    return await db.query.metroSystems.findMany({
      orderBy: (systems, { asc }) => [asc(systems.city)],
    })
  },

  async findSystemWithDetails(systemId: string) {
    const lines = await db.query.metroLines.findMany({
      where: eq(metroLines.systemId, systemId),
    })

    if (lines.length === 0) {
      return { id: systemId, city: '', lines: [] }
    }

    const lineStations = await db.query.metroLineStations.findMany({
      where: (lineStations, { inArray }) => inArray(lineStations.lineId, lines.map(l => l.id)),
      with: {
        station: true,
      },
      orderBy: (lineStations, { asc }) => [asc(lineStations.order)],
    })

    const stationsByLineId = lineStations.reduce((acc, ls) => {
      if (!acc[ls.lineId]) {
        acc[ls.lineId] = []
      }
      acc[ls.lineId].push(ls.station)
      return acc
    }, {} as Record<string, (typeof metroStations.$inferSelect)[]>)

    const linesWithStations = lines.map(line => ({
      ...line,
      id: line.id,
      name: line.name,
      color: line.color,
      lineNumber: line.lineNumber,
      stations: stationsByLineId[line.id] || [],
    }))

    const system = await db.query.metroSystems.findFirst({
      where: eq(metroSystems.id, systemId),
    })

    return {
      id: systemId,
      city: system?.city || '',
      lines: linesWithStations,
    }
  },

  // Новый метод для импорта
  async importSystem(data: z.infer<typeof ImportMetroSystemInputSchema>) {
    return await db.transaction(async (tx) => {
      // 1. Вставляем или обновляем Систему
      const [system] = await tx
        .insert(metroSystems)
        .values({
          id: data.id,
          city: data.city,
          country: data.country,
        })
        .onConflictDoUpdate({
          target: metroSystems.id,
          set: { city: data.city, country: data.country },
        })
        .returning()

      for (const line of data.lines) {
        // 2. Вставляем или обновляем Линию
        await tx
          .insert(metroLines)
          .values({
            id: line.id,
            systemId: system.id,
            name: line.name,
            lineNumber: line.lineNumber,
            color: line.color,
          })
          .onConflictDoUpdate({
            target: metroLines.id,
            set: { name: line.name, color: line.color, lineNumber: line.lineNumber },
          })

        // Подготавливаем станции и связи
        for (let i = 0; i < line.stations.length; i++) {
          const station = line.stations[i]

          // 3. Вставляем Станцию (если ID совпадает - ничего не делаем, считаем, что станция уже есть)
          await tx
            .insert(metroStations)
            .values({
              id: station.id,
              systemId: system.id,
              name: station.name,
            })
            .onConflictDoNothing()

          // 4. Связываем Станцию с Линией (с указанием порядка)
          await tx
            .insert(metroLineStations)
            .values({
              lineId: line.id,
              stationId: station.id,
              order: i,
            })
            .onConflictDoUpdate({
              target: [metroLineStations.lineId, metroLineStations.stationId],
              set: { order: i }, // Обновляем порядок, если связь уже была
            })
        }
      }

      return system
    })
  },
}
