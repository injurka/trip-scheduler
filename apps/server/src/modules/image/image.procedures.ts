import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  DeleteImageInputSchema,
  GetImageMetadataInputSchema,
  GetImagesByEntityInputSchema,
  GetImagesByTripIdInputSchema,
  ListDocumentsInputSchema,
  TripDocumentSchema,
  TripImageSchema,
  TripImageWithTripSchema,
  UpdateDocumentMetaInputSchema,
} from './image.schemas'
import { imageService } from './image.service'

export const imageProcedures = {
  listByTrip: publicProcedure
    .input(GetImagesByTripIdInputSchema)
    .output(z.array(TripImageSchema))
    .query(async ({ input }) => {
      return imageService.getByTripId(input.tripId, input.placement)
    }),

  listByEntity: publicProcedure
    .input(GetImagesByEntityInputSchema)
    .output(z.array(TripImageSchema))
    .query(async ({ input }) => {
      return imageService.getByEntity(input.entityId, input.entityType, input.placement)
    }),

  getAll: protectedProcedure
    .output(z.array(TripImageWithTripSchema))
    .query(async ({ ctx }) => {
      return imageService.getAll(ctx.user.id)
    }),

  getMetadata: publicProcedure
    .input(GetImageMetadataInputSchema)
    .output(z.any().nullable())
    .query(async ({ input }) => {
      return imageService.getMetadata(input.id)
    }),

  delete: protectedProcedure
    .input(DeleteImageInputSchema)
    .output(z.object({ success: z.boolean(), id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return imageService.delete(input.id, ctx.user.id)
    }),

  listDocuments: publicProcedure
    .input(ListDocumentsInputSchema)
    .output(z.array(TripDocumentSchema))
    .query(async ({ input, ctx }) => {
      return imageService.listDocuments(input.tripId, ctx.user?.id)
    }),

  updateDocumentMeta: protectedProcedure
    .input(UpdateDocumentMetaInputSchema)
    .output(TripDocumentSchema)
    .mutation(async ({ input, ctx }) => {
      return imageService.updateDocumentMeta(input.id, input.metadata, ctx.user.id)
    }),
}
