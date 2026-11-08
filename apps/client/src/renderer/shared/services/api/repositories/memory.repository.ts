import type { IMemoryRepository } from '../model/types'
import type { CreateMemoryInput, Memory, MemoryProposal, UpdateMemoryInput } from '~/shared/types/models/memory'
import type { RouterInput } from '~/shared/types/trpc'
import { trpc } from '~/shared/services/trpc/trpc.service'

export class MemoryRepository implements IMemoryRepository {
  async generate(data: RouterInput['memory']['generate']) {
    return trpc.memory.generate.mutate(data)
  }

  async applyGenerated(data: MemoryProposal): Promise<Memory[]> {
    return await trpc.memory.applyGenerated.mutate(data) as Memory[]
  }

  async getByTripId(tripId: string): Promise<Memory[]> {
    const result = await trpc.memory.getByTripId.query({ tripId })

    return result as Memory[]
  }

  async create(data: CreateMemoryInput): Promise<Memory> {
    const result = await trpc.memory.create.mutate(data)

    return result as Memory
  }

  async update(data: UpdateMemoryInput): Promise<Memory> {
    const result = await trpc.memory.update.mutate(data)

    return result as Memory
  }

  async delete(id: string): Promise<Memory> {
    const result = await trpc.memory.delete.mutate({ id })

    return result as Memory
  }

  async applyTakenAtTimestamp(id: string): Promise<Memory> {
    const result = await trpc.memory.applyTakenAt.mutate({ id })

    return result as Memory
  }

  async unassignTimestamp(id: string): Promise<Memory> {
    const result = await trpc.memory.unassignDate.mutate({ id })

    return result as Memory
  }
}
