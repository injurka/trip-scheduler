import type {
  IAiTripConceptProposal,
  IAiTripJobStatus,
  IAiTripRepository,
  IGenerateAiTripInput,
  IProposeAiTripConceptInput,
} from '../model/types'
import { trpc } from '~/shared/services/trpc/trpc.service'

class AiTripRepository implements IAiTripRepository {
  async proposeConcept(input: IProposeAiTripConceptInput): Promise<IAiTripConceptProposal> {
    return await trpc.aiTrip.proposeConcept.mutate(input) as IAiTripConceptProposal
  }

  async generate(input: IGenerateAiTripInput): Promise<{ jobId: string }> {
    return await trpc.aiTrip.generate.mutate(input) as { jobId: string }
  }

  async getStatus(jobId: string): Promise<IAiTripJobStatus> {
    return await trpc.aiTrip.getStatus.query({ jobId }) as IAiTripJobStatus
  }
}

export { AiTripRepository }
