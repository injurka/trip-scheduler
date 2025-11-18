import { z } from 'zod'

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
  meta: z.array(DayMetaInfoSchema).optional(),
  tripId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
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
  details: DaySchema.pick({ title: true, description: true, date: true, meta: true }).partial(),
})

export const DeleteDayInputSchema = z.object({
  id: z.string().uuid(),
})
