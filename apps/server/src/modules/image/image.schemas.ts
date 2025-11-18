import { z } from 'zod'

export const GetImagesByTripIdInputSchema = z.object({
  tripId: z.string().uuid(),
  placement: z.enum(['route', 'memories']).optional(),
})

export const DeleteImageInputSchema = z.object({
  id: z.string().uuid(),
})
