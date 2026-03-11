import { z } from 'zod'
import { protectedProcedure, publicProcedure } from '~/lib/trpc'
import {
  CreateNoteInputSchema,
  DeleteNoteInputSchema,
  GetNotesInputSchema,
  NoteImageUsageSchema,
  NoteSchema,
  ReorderNotesInputSchema,
  UpdateNoteInputSchema,
} from './note.schemas'
import { noteService } from './note.service'

export const noteProcedures = {
  getByTripId: publicProcedure
    .meta({ openapi: { method: 'GET', path: '/notes/by-trip/{tripId}', tags: ['Notes'], summary: 'Получить заметки/файлы путешествия' } })
    .input(GetNotesInputSchema)
    .output(z.array(NoteSchema))
    .query(async ({ input }) => {
      return noteService.getByTripId(input.tripId)
    }),

  create: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/notes', tags: ['Notes'], summary: 'Создать заметку/папку' } })
    .input(CreateNoteInputSchema)
    .output(NoteSchema)
    .mutation(async ({ input, ctx }) => {
      return noteService.create(input, ctx.user.id)
    }),

  update: protectedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/notes/{id}', tags: ['Notes'], summary: 'Обновить данные заметки' } })
    .input(UpdateNoteInputSchema)
    .output(NoteSchema)
    .mutation(async ({ input, ctx }) => {
      return noteService.update(input, ctx.user.id)
    }),

  delete: protectedProcedure
    .meta({ openapi: { method: 'DELETE', path: '/notes/{id}', tags: ['Notes'], summary: 'Удалить заметку или папку' } })
    .input(DeleteNoteInputSchema)
    .output(NoteSchema)
    .mutation(async ({ input, ctx }) => {
      return noteService.delete(input.id, ctx.user.id)
    }),

  reorder: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/notes/reorder', tags: ['Notes'], summary: 'Изменить порядок и иерархию файлов' } })
    .input(ReorderNotesInputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return noteService.reorder(input, ctx.user.id)
    }),

  getImagesUsage: publicProcedure
    .meta({ openapi: { method: 'GET', path: '/notes/images-usage/{tripId}', tags: ['Notes'], summary: 'Получить все загруженные картинки заметок и места их использования' } })
    .input(GetNotesInputSchema)
    .output(z.array(NoteImageUsageSchema))
    .query(async ({ input }) => {
      return noteService.getImagesUsage(input.tripId)
    }),
}
