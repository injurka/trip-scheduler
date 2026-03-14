import { z } from 'zod'

export const GetMarksInputSchema = z.object({
  screen: z.object({
    leftTop: z.object({ lat: z.number(), lon: z.number() }),
    rightBottom: z.object({ lat: z.number(), lon: z.number() }),
    center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  }).optional(),
  zoomlevel: z.number().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
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

export const MarkOutputSchema = z.object({
  id: z.string(),
  markName: z.string(),
  ownerId: z.string(),
  geom: z.object({
    type: z.literal('Point'),
    bbox: z.any().nullable().optional(),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  duration: z.number().nullable().optional(),
  isEnded: z.boolean(),
  category: z.object({
    id: z.number(),
    categoryName: z.string(),
    color: z.string(),
    icon: z.string(),
  }),
  additionalInfo: z.string().optional(),
  photo: z.array(z.string()).optional(),
  owner: z.object({
    id: z.string(),
    username: z.string(),
    avatar: z.string().optional(),
  }).optional(),
})

export const MarkListOutputSchema = z.array(MarkOutputSchema)
