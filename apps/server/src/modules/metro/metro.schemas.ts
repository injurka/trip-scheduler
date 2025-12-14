import { z } from 'zod'

// --- Output Schemas ---
export const MetroStationSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const MetroLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  lineNumber: z.string().nullable(),
})

export const MetroSystemSchema = z.object({
  id: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
})

export const MetroSystemDetailsSchema = MetroSystemSchema.extend({
  lines: z.array(
    MetroLineSchema.extend({
      stations: z.array(MetroStationSchema),
    }),
  ),
})

// --- Input Schemas ---
export const GetMetroSystemDetailsInputSchema = z.object({
  systemId: z.string(),
})

export const ImportMetroSystemInputSchema = z.object({
  id: z.string(),
  city: z.string(),
  country: z.string(),
  lines: z.array(
    z.object({
      id: z.string(),
      lineNumber: z.string().nullable().optional(),
      name: z.string(),
      color: z.string(),
      stations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        }),
      ),
    }),
  ),
})
