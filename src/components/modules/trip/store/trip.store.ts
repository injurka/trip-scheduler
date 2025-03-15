import type { Activity } from '../models/activity'
import { defineStore } from 'pinia'
import { MOCK_ACTIVITIES } from '../mock'
import { minutesToTime, timeToMinutes } from '../models/activity'

interface ActivitiesState {
  activities: Activity[]
  currentDay: number
}

export const useActivitiesStore = defineStore('activities', {
  state: (): ActivitiesState => ({
    activities: [...MOCK_ACTIVITIES],
    currentDay: 1,
  }),

  getters: {
    getActivitiesByDay: (state) => {
      return (day: number): Activity[] => {
        return state.activities
          .filter(activity => activity.day === day)
          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      }
    },

    getAllDays: (state): number[] => {
      const days = new Set<number>()
      state.activities.forEach(activity => days.add(activity.day))
      return Array.from(days).sort((a, b) => a - b)
    },
  },

  actions: {
    addActivity(activity: Activity): void {
      const dayActivities = this.getActivitiesByDay(activity.day)
      const newStart = timeToMinutes(activity.startTime)
      const newEnd = timeToMinutes(activity.endTime)

      const hasOverlap = dayActivities.some((existingActivity) => {
        if (existingActivity.id === activity.id)
          return false

        const existingStart = timeToMinutes(existingActivity.startTime)
        const existingEnd = timeToMinutes(existingActivity.endTime)

        return (
          (newStart >= existingStart && newStart < existingEnd)
          || (newEnd > existingStart && newEnd <= existingEnd)
          || (newStart <= existingStart && newEnd >= existingEnd)
        )
      })

      if (hasOverlap) {
        throw new Error('Активность пересекается с существующей по времени')
      }

      // Добавление или обновление активности
      const existingIndex = this.activities.findIndex(a => a.id === activity.id)
      if (existingIndex >= 0) {
        this.activities[existingIndex] = activity
      }
      else {
        this.activities.push(activity)
      }
    },

    removeActivity(id: string): void {
      const index = this.activities.findIndex(a => a.id === id)
      if (index >= 0) {
        this.activities.splice(index, 1)
      }
    },

    updateActivityPosition(id: string, newStartTime: string): void {
      const activityIndex = this.activities.findIndex(a => a.id === id)
      if (activityIndex === -1)
        return

      const activity = this.activities[activityIndex]
      const duration = timeToMinutes(activity.endTime) - timeToMinutes(activity.startTime)

      const newEndTime = minutesToTime(timeToMinutes(newStartTime) + duration)

      // Проверка на выход за границы дня
      if (timeToMinutes(newStartTime) < 6 * 60 || timeToMinutes(newEndTime) > 24 * 60) {
        return // Вне разрешенного диапазона (6:00 - 24:00)
      }

      // Проверка на пересечение с другими активностями
      const dayActivities = this.getActivitiesByDay(activity.day).filter(a => a.id !== id)
      const newStart = timeToMinutes(newStartTime)
      const newEnd = timeToMinutes(newEndTime)

      const hasOverlap = dayActivities.some((existingActivity) => {
        const existingStart = timeToMinutes(existingActivity.startTime)
        const existingEnd = timeToMinutes(existingActivity.endTime)

        return (
          (newStart >= existingStart && newStart < existingEnd)
          || (newEnd > existingStart && newEnd <= existingEnd)
          || (newStart <= existingStart && newEnd >= existingEnd)
        )
      })

      if (hasOverlap)
        return // Есть пересечение, не обновляем

      // Обновляем время
      this.activities[activityIndex] = {
        ...activity,
        startTime: newStartTime,
        endTime: newEndTime,
      }
    },

    reorderActivities(day: number, newOrder: Activity[]): void {
      const MIN_START_MINUTES = 6 * 60
      const MAX_END_MINUTES = 24 * 60

      let currentStart = MIN_START_MINUTES
      let hasOverflow = false

      const updatedActivities = newOrder.map((activity) => {
        const duration = timeToMinutes(activity.endTime) - timeToMinutes(activity.startTime)

        if (currentStart + duration > MAX_END_MINUTES || hasOverflow) {
          hasOverflow = true
          return activity
        }

        const newStartTime = minutesToTime(currentStart)
        const newEndTime = minutesToTime(currentStart + duration)

        currentStart += duration

        return {
          ...activity,
          startTime: newStartTime,
          endTime: newEndTime,
        }
      })

      const otherDaysActivities = this.activities.filter(a => a.day !== day)
      this.activities = [...otherDaysActivities, ...updatedActivities]
    },

    setCurrentDay(day: number): void {
      this.currentDay = day
    },
  },
})
