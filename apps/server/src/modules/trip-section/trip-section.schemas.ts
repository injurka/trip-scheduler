import { z } from 'zod'

export enum TripSectionType {
  BOOKINGS = 'bookings',
  FINANCES = 'finances',
  CHECKLIST = 'checklist',
  DOCUMENTS = 'documents',
  NOTES = 'notes',
}

export const TripSectionSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  type: z.nativeEnum(TripSectionType),
  title: z.string(),
  icon: z.string().nullable(),
  content: z.any(), 
  order: z.number(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

export const CreateTripSectionInputSchema = TripSectionSchema.pick({
  tripId: true,
  type: true,
  title: true,
  icon: true,
}).extend({
  content: z.any().optional(),
})

export const UpdateTripSectionInputSchema = TripSectionSchema.pick({
  id: true,
}).merge(TripSectionSchema.pick({
  title: true,
  icon: true,
  content: true,
}).partial())

export const DeleteTripSectionInputSchema = TripSectionSchema.pick({
  id: true,
})

export const ReorderTripSectionsInputSchema = z.object({
  tripId: z.string(),
  updates: z.array(z.object({
    id: z.string(),
    order: z.number(),
  })),
})
