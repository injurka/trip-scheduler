import type {
  CreateNoteInput,
  INoteRepository,
  NoteImageUsage,
  ReorderNotesInput,
  TripNote,
  UpdateNoteInput,
} from '../model/types'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'

export class NoteRepository implements INoteRepository {
  @throttle(500)
  async getByTripId(tripId: string): Promise<TripNote[]> {
    return await trpc.note.getByTripId.query({ tripId }) as TripNote[]
  }

  @throttle(500)
  async create(data: CreateNoteInput): Promise<TripNote> {
    return await trpc.note.create.mutate(data) as TripNote
  }

  @throttle(500)
  async update(data: UpdateNoteInput): Promise<TripNote> {
    return await trpc.note.update.mutate(data) as TripNote
  }

  @throttle(500)
  async delete(id: string): Promise<void> {
    await trpc.note.delete.mutate({ id })
  }

  @throttle(500)
  async reorder(data: ReorderNotesInput): Promise<void> {
    await trpc.note.reorder.mutate(data)
  }

  @throttle(500)
  async getImagesUsage(tripId: string): Promise<NoteImageUsage[]> {
    return await trpc.note.getImagesUsage.query({ tripId }) as NoteImageUsage[]
  }
}
