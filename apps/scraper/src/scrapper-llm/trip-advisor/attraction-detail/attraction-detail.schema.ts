import { z } from 'zod'

export const AttractionDetailSchema = z.object({
  location_name: z.string(),
  description: z.string().nullable(),
  address: z
    .object({
      street: z.string().nullable(),
      city: z.string().nullable(),
      country: z.string().nullable(),
    })
    .nullable(),
  openingHours: z.string().nullable(),
  suggestedDuration: z.string().nullable(),
  rating: z.number().nullable(),
  topReviews: z
    .array(
      z.object({
        title: z.string(),
        text: z.string(),
        author: z.string(),
        rating: z.number(),
      }),
    )
    .nullable(),
})

export type AttractionDetail = z.infer<typeof AttractionDetailSchema>
