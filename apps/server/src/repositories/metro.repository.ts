import type { metroStations } from '~/../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '~/../db'
import { metroLines, metroSystems } from '~/../db/schema'

export const metroRepository = {
  async findSystems() {
    return await db.query.metroSystems.findMany({
      orderBy: (systems, { asc }) => [asc(systems.city)],
    })
  },

  async findSystemWithDetails(systemId: string) {
    // Получаем все линии для данной системы
    const lines = await db.query.metroLines.findMany({
      where: eq(metroLines.systemId, systemId),
    })

    if (lines.length === 0) {
      return { id: systemId, city: '', lines: [] } // Возвращаем пустую структуру, если линий нет
    }

    // Получаем все связи станций и линий для этих линий
    const lineStations = await db.query.metroLineStations.findMany({
      where: (lineStations, { inArray }) => inArray(lineStations.lineId, lines.map(l => l.id)),
      with: {
        station: true,
      },
      orderBy: (lineStations, { asc }) => [asc(lineStations.order)],
    })

    // Группируем станции по линиям
    const stationsByLineId = lineStations.reduce((acc, ls) => {
      if (!acc[ls.lineId]) {
        acc[ls.lineId] = []
      }
      acc[ls.lineId].push(ls.station)
      return acc
    }, {} as Record<string, (typeof metroStations.$inferSelect)[]>)

    // Собираем итоговую структуру
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
}
