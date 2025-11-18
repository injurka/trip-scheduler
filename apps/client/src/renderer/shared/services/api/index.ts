import type {
  IAccountRepository,
  IActivityRepository,
  IAuthRepository,
  ICommentRepository,
  ICommunityRepository,
  IDatabaseClient,
  IDayRepository,
  IFileRepository,
  ILLMRepository,
  IMemoryRepository,
  IPlacesRepository,
  ITripRepository,
  ITripSectionRepository,
} from './model/types'
import { AccountRepository } from './repositories/account.repository'
import { ActivityRepository } from './repositories/activity.repository'
import { AuthRepository } from './repositories/auth.repository'
import { CommentRepository } from './repositories/comment.repository'
import { CommunityRepository } from './repositories/community.repository'
import { DayRepository } from './repositories/day.repository'
import { FileRepository } from './repositories/file.repository'
import { LLMRepository } from './repositories/llm.repository'
import { MemoryRepository } from './repositories/memory.repository'
import { PlacesRepository } from './repositories/places.repository'
import { TripSectionRepository } from './repositories/trip-section.repository'
import { TripRepository } from './repositories/trip.repository'

/**
 * Клиент базы данных, работающий через tRPC.
 * Взаимодействует с удаленным API вместо локальной базы данных.
 */
class TRPCDatabaseClient implements IDatabaseClient {
  trips: ITripRepository = new TripRepository()
  days: IDayRepository = new DayRepository()
  files: IFileRepository = new FileRepository()
  activities: IActivityRepository = new ActivityRepository()
  memories: IMemoryRepository = new MemoryRepository()
  auth: IAuthRepository = new AuthRepository()
  tripSections: ITripSectionRepository = new TripSectionRepository()
  comments: ICommentRepository = new CommentRepository()
  account: IAccountRepository = new AccountRepository()
  community: ICommunityRepository = new CommunityRepository()
  llm: ILLMRepository = new LLMRepository()
  places: IPlacesRepository = new PlacesRepository()
}

export { TRPCDatabaseClient }
