import { z } from 'zod'

export const TripImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  originalName: z.string(),
  sizeBytes: z.number().default(0),
  createdAt: z.date(),
  tripId: z.string().optional(),
  placement: z.enum(['route', 'memories', 'notes', 'cover', 'content', 'documents']).optional(),
  variants: z.any().nullable().optional(),
  takenAt: z.date().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  metadata: z.any().nullable().optional(),
})

export const TripImageWithTripSchema = TripImageSchema.extend({
  trip: z.object({ id: z.string(), title: z.string() }).nullable().optional(),
})

export const GetImagesByTripIdInputSchema = z.object({
  tripId: z.string().uuid(),
  placement: z.enum(['route', 'memories', 'notes', 'documents']).optional(),
})

export const GetImagesByEntityInputSchema = z.object({
  entityId: z.string(),
  entityType: z.enum(['trip', 'post', 'blog', 'avatar']),
  placement: z.string().optional(),
})

export const DeleteImageInputSchema = z.object({ id: z.string().uuid() })
export const GetImageMetadataInputSchema = z.object({ id: z.string().uuid() })

export const DocumentMetadataSchema = z.object({
  access: z.enum(['public', 'private']).default('private'),
  folderId: z.string().nullable().default(null),
})

export const TripDocumentSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  url: z.string(),
  originalName: z.string(),
  sizeBytes: z.number(),
  createdAt: z.date(),
  metadata: DocumentMetadataSchema,
})

export const ListDocumentsInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const UpdateDocumentMetaInputSchema = z.object({
  id: z.string().uuid(),
  metadata: DocumentMetadataSchema.partial(),
})
