import { z } from 'zod'
import { ActivitySchema } from '../activity/activity.schemas'

export const DayMetaInfoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
})

export const DaySchema = z.object({
  id: z.string().uuid(),
  date: z.union([z.string(), z.date()]),
  title: z.string(),
  description: z.string().nullable(),
  note: z.string().optional().nullable(),
  meta: z.array(DayMetaInfoSchema).optional(),
  tripId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const DayWithActivitiesSchema = DaySchema.extend({
  activities: z.array(ActivitySchema),
})

export const GetDayNoteInputSchema = z.object({
  dayId: z.string().uuid(),
})

export const GenerateDayNoteInputSchema = z.object({
  dayId: z.string().uuid(),
  prompt: z.string(),
  useContext: z.boolean().default(false),
})

export const GenerateTemplateInputSchema = z.object({
  dayId: z.string().uuid(),
  prompt: z.string(),
  currentActivities: z.array(z.any()),
  canvasNote: z.string().optional().nullable(),
  daysContext: z.array(z.object({
    dayNumber: z.number(),
    date: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    activitiesSummary: z.array(z.object({
      startTime: z.string(),
      endTime: z.string(),
      title: z.string(),
      tag: z.string(),
    })),
  })).optional().nullable(),
})

export const GetDayByIdInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const CreateDayInputSchema = DaySchema.pick({
  tripId: true,
  title: true,
  description: true,
  date: true,
})

export const UpdateDayInputSchema = z.object({
  id: z.string().uuid(),
  details: DaySchema.pick({
    title: true,
    description: true,
    date: true,
    meta: true,
    note: true,
  }).partial(),
})

export const DeleteDayInputSchema = z.object({
  id: z.string().uuid(),
})
