import type { z } from 'zod'
import type {
  MetroLineSchema,
  MetroStationSchema,
  MetroSystemDetailsSchema,
  MetroSystemSchema,
} from './metro.schemas'

export type MetroSystem = z.infer<typeof MetroSystemSchema>
export type MetroLine = z.infer<typeof MetroLineSchema>
export type MetroStation = z.infer<typeof MetroStationSchema>
export type MetroSystemDetails = z.infer<typeof MetroSystemDetailsSchema>
