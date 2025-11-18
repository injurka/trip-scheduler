import { z } from 'zod'
import { DaySchema } from '../day/day.schemas'
import { UserSchema } from '../user/user.schemas'

export const TripParticipantSchema = UserSchema.pick({
  id: true,
  name: true,
  avatarUrl: true,
})

export const TripSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  imageUrl: z.string().nullable(),
  description: z.string().nullable(),
  startDate: z.union([z.date(), z.string()]),
  endDate: z.union([z.date(), z.string()]),
  cities: z.array(z.string()),
  status: z.enum(['completed', 'planned', 'draft']),
  budget: z.number().nullable(),
  currency: z.string().nullable(),
  participants: z.array(TripParticipantSchema),
  tags: z.array(z.string()),
  visibility: z.enum(['public', 'private']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TripWithDaysSchema = TripSchema.extend({
  days: z.array(DaySchema),
})

export const GetTripByIdInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const UpdateTripInputSchema = z.object({
  id: z.string().uuid(),
  details: TripSchema.pick({
    title: true,
    description: true,
    startDate: true,
    endDate: true,
    cities: true,
    status: true,
    budget: true,
    currency: true,
    tags: true,
    visibility: true,
    imageUrl: true,
  }).partial().extend({
    participantIds: z.array(z.string().uuid()).optional(),
  }),
})

export const CreateTripInputSchema = TripSchema.pick({
  title: true,
}).extend({
  description: z.string().optional(),
  startDate: z.union([z.date(), z.string()]).optional(),
  endDate: z.union([z.date(), z.string()]).optional(),
})

export const ListTripsInputSchema = z.object({
  tab: z.enum(['my', 'public']).optional(),
  search: z.string().optional(),
  statuses: z.array(z.enum(['completed', 'planned', 'draft'])).optional(),
  tags: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
}).optional()

export const ListTripsByUserInputSchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().min(1).max(10).optional().default(3),
})
