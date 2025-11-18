import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { metroLines, metroStations, metroSystems } from '~/../db/schema'

// --- Output Schemas ---

export const MetroSystemSchema = createSelectSchema(metroSystems)

export const MetroStationSchema = createSelectSchema(metroStations)

export const MetroLineSchema = createSelectSchema(metroLines)

export const MetroSystemDetailsSchema = z.object({
  id: z.string(),
  city: z.string(),
  lines: z.array(MetroLineSchema.extend({
    lineNumber: z.string().nullable(),
    stations: z.array(MetroStationSchema),
  })),
})

// --- Input Schemas ---

export const GetMetroSystemDetailsInputSchema = z.object({
  systemId: z.string(),
})
