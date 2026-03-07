import type { IMarksRepository } from '../model/types'
import type {
  CreateMarkInput,
  GetMarksParams,
  Mark,
} from '~/shared/types/models/mark'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'

export class MarksRepository implements IMarksRepository {
  @throttle(500)
  async getMarks(params: GetMarksParams): Promise<Mark[]> {
    const result = await trpc.mark.list.query(params)
    return result as Mark[]
  }

  @throttle(500)
  async createMark(data: CreateMarkInput): Promise<Mark> {
    const { photos, ...inputData } = data

    const result = await trpc.mark.create.mutate(inputData)
    return result as Mark
  }
}
