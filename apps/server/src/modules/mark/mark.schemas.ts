import { z } from 'zod'

export const GetMarksInputSchema = z.object({
  screen: z.object({
    leftTop: z.object({ lat: z.number(), lon: z.number() }),
    rightBottom: z.object({ lat: z.number(), lon: z.number() }),
    center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  }),
  zoomlevel: z.number(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
})

export const CreateMarkInputSchema = z.object({
  markName: z.string().min(1, 'Название обязательно'),
  additionalInfo: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  categoryId: z.number().default(1),
  startAt: z.string().datetime().optional(),
  duration: z.number().default(0),
})
