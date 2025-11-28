import { z } from 'zod'

// Schema for the list scraping (Step 1)
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

// Schema for the detail scraping (Step 2)
export const AttractionDetailSchema = z.object({
  location_name: z.string(),
  description: z.string().nullable(),
  address: z.object({
    street: z.string().nullable(),
    city: z.string().nullable(),
    country: z.string().nullable(),
  }).nullable(),
  openingHours: z.string().nullable(),
  suggestedDuration: z.string().nullable(),
  rating: z.number().nullable(),
  topReviews: z.array(z.object({
    title: z.string(),
    text: z.string(),
    author: z.string(),
    rating: z.number(),
  })).nullable(),
})

export type AttractionDetail = z.infer<typeof AttractionDetailSchema>
