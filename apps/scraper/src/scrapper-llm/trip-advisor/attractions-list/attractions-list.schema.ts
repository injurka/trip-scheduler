import { z } from 'zod'

export const AttractionListItemSchema = z.object({
  location_name: z.string(),
  rating: z.number().nullable(),
  category: z.string().nullable(),
  url: z.string().url(),
  imageUrl: z.array(z.string().url()).nullable(),
  reviewSnippet: z.string().nullable(),
})

export const AttractionListSchema = z.array(AttractionListItemSchema)

export type AttractionListItem = z.infer<typeof AttractionListItemSchema>
