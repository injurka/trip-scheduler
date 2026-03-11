import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { tripNotes } from '~/../db/schema'

export const NoteImageSchema = z.object({
  id: z.string(),
  sources: z.record(z.string(), z.string()),
})

export const NoteSchema = createSelectSchema(tripNotes).extend({
  images: z.array(NoteImageSchema).optional(),
})

export const CreateNoteInputSchema = z.object({
  tripId: z.string().uuid(),
  parentId: z.string().uuid().optional().nullable(),
  type: z.enum(['folder', 'markdown', 'excalidraw']),
  title: z.string().min(1, 'Название обязательно'),
  order: z.number().optional().default(0),
})

export const UpdateNoteInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  order: z.number().optional(),
  imageIds: z.array(z.string().uuid()).optional(),
})

export const DeleteNoteInputSchema = z.object({
  id: z.string().uuid(),
})

export const GetNotesInputSchema = z.object({
  tripId: z.string().uuid(),
})

export const ReorderNotesInputSchema = z.object({
  tripId: z.string().uuid(),
  updates: z.array(z.object({
    id: z.string().uuid(),
    parentId: z.string().uuid().nullable(),
    order: z.number(),
  })),
})

export const NoteImageUsageSchema = z.object({
  id: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  sources: z.record(z.string(), z.string()),
  usedIn: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
  })),
})
