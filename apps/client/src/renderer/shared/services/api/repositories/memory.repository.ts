import type { IMemoryRepository } from '../model/types'
import type { CreateMemoryInput, Memory, MemoryProposal, UpdateMemoryInput } from '~/shared/types/models/memory'
import type { RouterInput } from '~/shared/types/trpc'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { throttle } from '../lib/decorators'

export class MemoryRepository implements IMemoryRepository {
  async generate(data: RouterInput['memory']['generate']) {
    return trpc.memory.generate.mutate(data)
  }

  async applyGenerated(data: MemoryProposal): Promise<Memory[]> {
    return await trpc.memory.applyGenerated.mutate(data) as Memory[]
  }

  @throttle(500)
  async getByTripId(tripId: string): Promise<Memory[]> {
    const result = await trpc.memory.getByTripId.query({ tripId })

    return result as Memory[]
  }

  @throttle(500)
  async create(data: CreateMemoryInput): Promise<Memory> {
    const result = await trpc.memory.create.mutate(data)

    return result as Memory
  }

  @throttle(500)
  async update(data: UpdateMemoryInput): Promise<Memory> {
    const result = await trpc.memory.update.mutate(data)

    return result as Memory
  }

  @throttle(500)
  async delete(id: string): Promise<Memory> {
    const result = await trpc.memory.delete.mutate({ id })

    return result as Memory
  }

  @throttle(500)
  async applyTakenAtTimestamp(id: string): Promise<Memory> {
    const result = await trpc.memory.applyTakenAt.mutate({ id })

    return result as Memory
  }

  @throttle(500)
  async unassignTimestamp(id: string): Promise<Memory> {
    const result = await trpc.memory.unassignDate.mutate({ id })

    return result as Memory
  }
}
