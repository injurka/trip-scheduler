import type { IAiTripJobStatus, IAiTripRepository } from '../model/types'
import { trpc } from '~/shared/services/trpc/trpc.service'

class AiTripRepository implements IAiTripRepository {
  async generate(input: { country: string, startDate: string, days: number, wishes?: string }): Promise<{ jobId: string }> {
    return await trpc.aiTrip.generate.mutate(input) as { jobId: string }
  }

  async getStatus(jobId: string): Promise<IAiTripJobStatus> {
    return await trpc.aiTrip.getStatus.query({ jobId }) as IAiTripJobStatus
  }
}

export { AiTripRepository }
