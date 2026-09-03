import { z } from 'zod'
import { DayWithActivitiesSchema } from '../day/day.schemas'
import { TripSectionSchema } from '../trip-section/trip-section.schemas'
import { UserSchema } from '../user/user.schemas'

export const TripParticipantSchema = UserSchema.pick({
  id: true,
  name: true,
  avatarUrl: true,
})

export const CityWeatherSchema = z.object({
  city: z.string(),
  tempAverage: z.number().nullable(),
  tempMin: z.number().nullable(),
  tempMax: z.number().nullable(),
  feelsLike: z.number().nullable().optional(),
  rainyDays: z.number().nullable().optional(),
  precipitationProbability: z.number().nullable().optional(),
  precipitationType: z.string().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  windDescription: z.string().nullable().optional(),
  seasonality: z.enum(['low', 'medium', 'high', 'peak']).nullable().optional(),
  seasonalityDescription: z.string().nullable().optional(),
  daylight: z.string().nullable().optional(),
  clothingRecommendation: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  updatedAt: z.string(),
})

export const TripWeatherSchema = z.record(z.string(), CityWeatherSchema)

export const TripSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  imageUrl: z.string().nullable(),
  description: z.string().nullable(),
  descriptionShort: z.string().nullable(),
  startDate: z.union([z.date(), z.string()]),
  endDate: z.union([z.date(), z.string()]),
  cities: z.array(z.string()),
  status: z.enum(['completed', 'planned', 'draft']),
  budget: z.number().nullable(),
  currency: z.string().nullable(),
  participants: z.array(TripParticipantSchema),
  tags: z.array(z.string()),
  weatherData: TripWeatherSchema.nullable().optional(),
  visibility: z.enum(['public', 'private']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TripWithDaysSchema = TripSchema.extend({
  days: z.array(DayWithActivitiesSchema),
  sections: z.array(TripSectionSchema).optional().default([]),
})

export const GetTripByIdInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const UpdateTripInputSchema = z.object({
  id: z.string().uuid(),
  details: TripSchema.pick({
    title: true,
    description: true,
    descriptionShort: true,
    startDate: true,
    endDate: true,
    cities: true,
    status: true,
    budget: true,
    currency: true,
    tags: true,
    visibility: true,
    imageUrl: true,
    weatherData: true,
  }).partial().extend({
    participantIds: z.array(z.string().uuid()).optional(),
  }),
})

export const GenerateWeatherInputSchema = z.object({
  tripId: z.string().uuid(),
  city: z.string().optional(),
  forceRefresh: z.boolean().optional().default(false),
})

export const GenerateWeatherOutputSchema = z.object({
  weatherData: TripWeatherSchema,
  fromCache: z.boolean(),
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

export const AddParticipantInputSchema = z.object({
  tripId: z.string().uuid(),
  userId: z.string().uuid(),
})
