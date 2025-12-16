import type {
  IActivityRepository,
  IAuthRepository,
  ICommentRepository,
  IDatabaseClient,
  IDayRepository,
  IFileRepository,
  ILLMRepository,
  IMemoryRepository,
  IPlacesRepository,
  ITripRepository,
  ITripSectionRepository,
  IUserRepository,
} from './model/types'
import { ActivityRepository } from './repositories/activity.repository'
import { AuthRepository } from './repositories/auth.repository'
import { BlogRepository } from './repositories/blog.repository'
import { CommentRepository } from './repositories/comment.repository'
import { DayRepository } from './repositories/day.repository'
import { FileRepository } from './repositories/file.repository'
import { LLMRepository } from './repositories/llm.repository'
import { MemoryRepository } from './repositories/memory.repository'
import { PlacesRepository } from './repositories/places.repository'
import { TripSectionRepository } from './repositories/trip-section.repository'
import { TripRepository } from './repositories/trip.repository'
import { UserRepository } from './repositories/user.repository'

/**
 * Клиент базы данных, работающий через tRPC.
 */
class TRPCDatabaseClient implements IDatabaseClient {
  trips: ITripRepository = new TripRepository()
  days: IDayRepository = new DayRepository()
  files: IFileRepository = new FileRepository()
  activities: IActivityRepository = new ActivityRepository()
  memories: IMemoryRepository = new MemoryRepository()
  auth: IAuthRepository = new AuthRepository()
  blog = new BlogRepository()
  user: IUserRepository = new UserRepository()
  tripSections: ITripSectionRepository = new TripSectionRepository()
  comments: ICommentRepository = new CommentRepository()
  llm: ILLMRepository = new LLMRepository()
  places: IPlacesRepository = new PlacesRepository()
}

export { TRPCDatabaseClient }
