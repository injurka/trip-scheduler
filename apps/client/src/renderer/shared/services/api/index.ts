import type {
  IActivityRepository,
  IAuthRepository,
  IBlogRepository,
  ICommentRepository,
  IDatabaseClient,
  IDayRepository,
  IFileRepository,
  ILLMRepository,
  IMarksRepository,
  IMemoryRepository,
  INotificationRepository,
  IPlacesRepository,
  IPostRepository,
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
import { MarksRepository } from './repositories/marks.repository'
import { MemoryRepository } from './repositories/memory.repository'
import { NotificationRepository } from './repositories/notification.repository'
import { PlacesRepository } from './repositories/places.repository'
import { PostRepository } from './repositories/post.repository'
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
  blog: IBlogRepository = new BlogRepository()
  user: IUserRepository = new UserRepository()
  tripSections: ITripSectionRepository = new TripSectionRepository()
  comments: ICommentRepository = new CommentRepository()
  llm: ILLMRepository = new LLMRepository()
  places: IPlacesRepository = new PlacesRepository()
  marks: IMarksRepository = new MarksRepository()
  notification: INotificationRepository = new NotificationRepository()
  posts: IPostRepository = new PostRepository()
}

export { TRPCDatabaseClient }
