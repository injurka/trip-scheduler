import { z } from 'zod'

export const TripComAttractionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  url: z.string().url(),
  imageUrl: z.string().nullable(),
  score: z.number().nullable(),
  reviewCount: z.string().nullable(), // Оставляем строкой, так как там может быть "15.2k reviews"
  categoryTags: z.array(z.string()).nullable(),
  price: z.number().nullable(), // Цена "от"
  description: z.string().nullable(), // Комментарий пользователя или описание
})

export const TripComListSchema = z.array(TripComAttractionSchema)

export type TripComAttraction = z.infer<typeof TripComAttractionSchema>
