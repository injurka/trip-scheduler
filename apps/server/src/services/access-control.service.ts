import { createTRPCError } from '~/lib/trpc'
import { activityRepository } from '~/repositories/activity.repository'
import { dayRepository } from '~/repositories/day.repository'
import { imageRepository } from '~/repositories/image.repository'
import { memoryRepository } from '~/repositories/memory.repository'
import { noteRepository } from '~/repositories/note.repository'
import { postRepository } from '~/repositories/post.repository'
import { tripSectionRepository } from '~/repositories/trip-section.repository'
import { tripRepository } from '~/repositories/trip.repository'

async function verifyAccess(
  ownerId: string | undefined | null,
  currentUserId: string,
  currentUserRole: string,
  errorMessage: string,
) {
  if (ownerId !== currentUserId && currentUserRole !== 'admin') {
    throw createTRPCError('FORBIDDEN', errorMessage)
  }
}

export const accessControlService = {
  async getTripAndVerifyAccess(tripId: string, userId: string, userRole: string) {
    const trip = await tripRepository.getById(tripId)
    if (!trip) {
      throw createTRPCError('NOT_FOUND', 'Путешествие не найдено.')
    }
    await verifyAccess(trip.userId, userId, userRole, 'У вас нет прав на доступ к этому путешествию.')
    return trip
  },

  async getDayAndVerifyAccess(dayId: string, userId: string, userRole: string) {
    const day = await dayRepository.findByIdWithOwner(dayId)
    if (!day) {
      throw createTRPCError('NOT_FOUND', `День с ID ${dayId} не найден.`)
    }
    await verifyAccess(day.trip.userId, userId, userRole, 'У вас нет прав на доступ к этому дню.')
    return day
  },

  async getActivityAndVerifyAccess(activityId: string, userId: string, userRole: string) {
    const activity = await activityRepository.findByIdWithOwner(activityId)
    if (!activity) {
      throw createTRPCError('NOT_FOUND', `Активность с ID ${activityId} не найдена.`)
    }
    await verifyAccess(activity.day.trip.userId, userId, userRole, 'У вас нет прав на доступ к этой активности.')
    return activity
  },

  async getMemoryAndVerifyAccess(memoryId: string, userId: string, userRole: string) {
    const memory = await memoryRepository.findByIdWithOwner(memoryId)
    if (!memory) {
      throw createTRPCError('NOT_FOUND', `Воспоминание с ID ${memoryId} не найдено.`)
    }
    await verifyAccess(memory.trip.userId, userId, userRole, 'У вас нет прав на доступ к этому воспоминанию.')
    return memory
  },

  async getNoteAndVerifyAccess(noteId: string, userId: string, userRole: string) {
    const note = await noteRepository.getById(noteId)
    if (!note) {
      throw createTRPCError('NOT_FOUND', 'Заметка не найдена.')
    }
    await verifyAccess(note.trip.userId, userId, userRole, 'У вас нет прав на доступ к этой заметке.')
    return note
  },

  async getTripSectionAndVerifyAccess(sectionId: string, userId: string, userRole: string) {
    const section = await tripSectionRepository.findByIdWithOwner(sectionId)
    if (!section) {
      throw createTRPCError('NOT_FOUND', `Раздел с ID ${sectionId} не найден.`)
    }
    await verifyAccess(section.trip.userId, userId, userRole, 'У вас нет прав на доступ к этому разделу.')
    return section
  },

  async getImageAndVerifyAccess(imageId: string, userId: string, userRole: string) {
    const image = await imageRepository.getById(imageId)
    if (!image) {
      throw createTRPCError('NOT_FOUND', 'Файл не найден.')
    }
    await verifyAccess(image.trip?.userId, userId, userRole, 'У вас нет прав на доступ к этому файлу.')
    return image
  },

  async getPostAndVerifyAccess(postId: string, userId: string, userRole: string) {
    const post = await postRepository.findById(postId, userId)
    if (!post) {
      throw createTRPCError('NOT_FOUND', 'Пост не найден.')
    }
    await verifyAccess(post.userId, userId, userRole, 'У вас нет прав на доступ к этому посту.')
    return post
  },
}
