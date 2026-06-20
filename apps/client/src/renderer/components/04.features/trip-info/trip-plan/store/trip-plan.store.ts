/* eslint-disable no-console */
import type { IActivity, IDay } from '../models/types'
import type { Trip, TripSection, UpdateTripInput } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { useRequest, useRequestError, useRequestStatus, useRequestStatusByPrefix, useRequestStore } from '~/plugins/request'
import { createApiErrorHandler } from '~/plugins/request/lib/error-handler'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useActivityDiff } from '../composables/use-activity-diff'

export enum ETripPlanKeys {
  FETCH_TRIP_DETAILS = 'trip-plan:fetch-details',
  FETCH_DAY_NOTE = 'trip-plan:fetch-day-note',
  ADD_DAY = 'trip-plan:add-day',
  UPDATE_DAY = 'trip-plan:update-day',
  DELETE_DAY = 'trip-plan:delete-day',
  ADD_ACTIVITY = 'trip-plan:add-activity',
  UPDATE_ACTIVITY = 'trip-plan:update-activity',
  UPDATE_DAY_NOTE = 'trip-plan:update-day-note',
  REMOVE_ACTIVITY = 'trip-plan:remove-activity',
  UPDATE_TRIP = 'trip-plan:update-trip',
  DELETE_TRIP = 'trip-plan:delete-trip',
  ADD_PARTICIPANT = 'trip-plan:add-participant',
}

export interface ITripPlanState {
  trip: Trip | null
  days: IDay[]
  currentTripId: string | null
  currentDayId: string | null
  dayNote: Map<string, string>
  /** Draft-версии конкретных активностей (activityId -> proposed Activity) */
  activityDrafts: Map<string, IActivity>
  deletedDraftsCache: Map<string, Map<string, IActivity>>
  isPreviewMode: boolean
}

/**
 * Стор для управления ДАННЫМИ о маршруте путешествия,
 * включая его дни и активности.
 */
export const useTripPlanStore = defineStore('tripPlan', {
  state: (): ITripPlanState => ({
    trip: null,
    days: [],
    currentTripId: null,
    currentDayId: null,
    dayNote: new Map(),
    activityDrafts: new Map(),
    deletedDraftsCache: new Map(),
    isPreviewMode: false,
  }),

  getters: {
    isLoading: () => useRequestStatus(ETripPlanKeys.FETCH_TRIP_DETAILS).value,
    fetchError: () => useRequestError(ETripPlanKeys.FETCH_TRIP_DETAILS).value,
    isLoadingUpdateDay: () => useRequestStatus(ETripPlanKeys.UPDATE_DAY).value,
    isLoadingNewDay: () => useRequestStatus(ETripPlanKeys.ADD_DAY).value,
    isLoadingUpdateActivity: () => useRequestStatusByPrefix(ETripPlanKeys.UPDATE_ACTIVITY).value,
    isLoadingNote: () => useRequestStatus(ETripPlanKeys.FETCH_DAY_NOTE).value,
    isLoadingUpdateNote: () => useRequestStatus(ETripPlanKeys.UPDATE_DAY_NOTE).value,
    isAddingParticipant: () => useRequestStatus(ETripPlanKeys.ADD_PARTICIPANT).value,

    getAllDays(state): IDay[] {
      return state.days
    },

    getSelectedDay(state): IDay | null {
      if (!state.currentDayId)
        return null

      return state.days.find(day => day.id === state.currentDayId) ?? null
    },

    getActivitiesForSelectedDay(state): IActivity[] {
      const day = this.getSelectedDay
      if (!day) return []
      let activities = day.activities.slice()
      if (state.isPreviewMode) {
        activities = activities.map(a => state.activityDrafts.get(a.id) ?? a)
      } else {
        activities = activities.filter(a => !a.id.startsWith('new-ai-'))
      }
      return activities.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    },

    /** Возвращает все ID активностей, для которых есть незакоммиченный черновик */
    hasDraftForDay(state): boolean {
      if (!state.currentDayId) return false
      const day = state.days.find(d => d.id === state.currentDayId)
      if (!day) return false
      return day.activities.some(a => state.activityDrafts.has(a.id))
    },

    /** Получить черновик для конкретной активности */
    getDraftForActivity: (state) => (activityId: string): IActivity | null => {
      return state.activityDrafts.get(activityId) ?? null
    },

    currentDayIndex(state): number {
      if (!state.currentDayId || !state.days)
        return -1
      return state.days.findIndex(day => day.id === state.currentDayId)
    },

    getPreviousDayId(): string | null {
      if (this.currentDayIndex > 0)
        return this.days[this.currentDayIndex - 1].id
      return null
    },

    getNextDayId(): string | null {
      if (this.currentDayIndex !== -1 && this.currentDayIndex < this.days.length - 1)
        return this.days[this.currentDayIndex + 1].id
      return null
    },

    getNoteForCurrentDay(state): string | null {
      if (!state.currentDayId)
        return null

      return state.dayNote.get(state.currentDayId) ?? null
    },
  },

  actions: {
    setCurrentDay(dayId: string): void {
      this.currentDayId = dayId
    },

    /** Сохранить черновик для конкретной активности */
    setActivityDraft(activityId: string, draft: IActivity) {
      this.activityDrafts.set(activityId, draft)
    },

    /** Принять черновик активности — применить к реальным данным */
    acceptActivityDraft(dayId: string, activityId: string) {
      const draft = this.activityDrafts.get(activityId)
      if (!draft) return
      const day = this.days.find(d => d.id === dayId)
      if (!day) return
      const idx = day.activities.findIndex(a => a.id === activityId)
      if (idx !== -1) {
        day.activities[idx] = draft
        this.updateActivity(dayId, draft)
      } else if (activityId.startsWith('new-ai-')) {
        // Accept a new AI activity
        // We need to call the actual addActivity method, but removing the 'new-ai-' temp ID.
        // Or wait, addActivity generates its own temp ID. 
        // Let's just remove it from day.activities and call addActivity.
        const newActIndex = day.activities.findIndex(a => a.id === activityId)
        if (newActIndex !== -1) day.activities.splice(newActIndex, 1)
        this.addActivity(dayId, { ...draft, id: undefined } as any)
      }
      this.activityDrafts.delete(activityId)
      this.isPreviewMode = false
    },

    /** Отклонить черновик для конкретной активности */
    discardActivityDraft(activityId: string) {
      if (activityId.startsWith('new-ai-')) {
        // If it was a new AI activity, remove it from the day array
        for (const day of this.days) {
          const idx = day.activities.findIndex(a => a.id === activityId)
          if (idx !== -1) {
            day.activities.splice(idx, 1)
          }
        }
      }
      this.activityDrafts.delete(activityId)
      this.isPreviewMode = false
    },

    /** Принять все черновики дня */
    acceptAllDraftsForDay(dayId: string) {
      const day = this.days.find(d => d.id === dayId)
      if (!day) return

      const newActivitiesToAdd: IActivity[] = []

      // Build a fresh activities array: apply drafts for existing, drop new-ai- temp entries
      const nextActivities: IActivity[] = []
      for (const activity of day.activities) {
        const draft = this.activityDrafts.get(activity.id)
        if (activity.id.startsWith('new-ai-')) {
          // Will be added via addActivity after the loop — skip here
          if (draft) newActivitiesToAdd.push(draft)
        }
        else {
          // Existing activity: use draft if present, otherwise keep original
          nextActivities.push(draft ?? activity)
          if (draft) this.updateActivity(dayId, draft)
        }
        this.activityDrafts.delete(activity.id)
      }

      // Atomically replace the activities array (no in-loop splices → no order/dupe bugs)
      day.activities = nextActivities

      // Persist new AI-generated activities
      for (const draft of newActivitiesToAdd) {
        this.addActivity(dayId, { ...draft, id: undefined } as any)
      }
      this.isPreviewMode = false
    },

    /** Отклонить все черновики дня */
    discardAllDraftsForDay(dayId: string) {
      const day = this.days.find(d => d.id === dayId)
      if (!day) return

      // Save to cache for undo
      const cache = new Map<string, IActivity>()
      for (const [key, draft] of this.activityDrafts.entries()) {
        const originalAct = day.activities.find(a => a.id === key)
        if (originalAct || key.startsWith('new-ai-')) {
          cache.set(key, draft)
        }
      }
      this.deletedDraftsCache.set(dayId, cache)

      day.activities = day.activities.filter(a => !a.id.startsWith('new-ai-'))
      for (const activity of day.activities) {
        this.activityDrafts.delete(activity.id)
      }
      // Also delete any remaining new-ai drafts that might be orphaned
      for (const key of Array.from(this.activityDrafts.keys())) {
        if (key.startsWith('new-ai-')) this.activityDrafts.delete(key)
      }
      this.isPreviewMode = false
    },

    undoDiscardAllDraftsForDay(dayId: string) {
      const cache = this.deletedDraftsCache.get(dayId)
      if (!cache) return
      
      const day = this.days.find(d => d.id === dayId)
      if (!day) return

      for (const [key, draft] of cache.entries()) {
        if (key.startsWith('new-ai-')) {
          // Re-add to activities so it renders
          if (!day.activities.find(a => a.id === key)) {
            day.activities.push(draft)
          }
        }
        this.activityDrafts.set(key, draft)
      }

      this.deletedDraftsCache.delete(dayId)
    },

    selectNextDay() {
      if (this.getNextDayId)
        this.setCurrentDay(this.getNextDayId)
    },

    selectPreviousDay() {
      if (this.getPreviousDayId)
        this.setCurrentDay(this.getPreviousDayId)
    },

    fetchTripDetails(tripId: string, initialDayIdFromQuery: string | undefined, onSectionsLoad?: (sections: TripSection[]) => void) {
      this.currentTripId = tripId

      useRequest({
        key: ETripPlanKeys.FETCH_TRIP_DETAILS,
        abortOnUnmount: true,
        fn: db => db.trips.getByIdWithDays(tripId),
        onSuccess: (result) => {
          if (!result) {
            this.trip = null
            this.days = []
            this.currentDayId = null
            onSectionsLoad?.([])
            useToast().error('Путешествие не найдено.')

            return
          }

          const { days, sections, ...tripData } = result
          this.trip = tripData as Trip

          const sortedDays = result.days.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          this.days = sortedDays as IDay[]

          this.dayNote.clear()
          sortedDays.forEach((day: any) => {
            if (day.note) {
              this.dayNote.set(day.id, day.note)
            }
          })

          onSectionsLoad?.(result.sections || [])

          const dayFromQueryIsValid = initialDayIdFromQuery && sortedDays.some(d => d.id === initialDayIdFromQuery)

          if (dayFromQueryIsValid) {
            this.currentDayId = initialDayIdFromQuery
          }
          else {
            this.currentDayId = null
          }
        },
        onError: ({ error }) => {
          this.trip = null
          this.days = []
          this.currentDayId = null
          onSectionsLoad?.([])

          console.error(`Ошибка при загрузке данных для путешествия ${tripId}: `, error)
          useToast().error(`Ошибка при загрузке данных: ${error.customMessage}`)
        },
      })
    },

    async updateTrip(details: UpdateTripInput) {
      if (!this.trip)
        return

      const originalTrip = { ...this.trip }
      Object.assign(this.trip, details)

      await useRequest({
        key: `${ETripPlanKeys.UPDATE_TRIP}:${this.trip.id}`,
        fn: db => db.trips.update(this.trip!.id, details),
        onSuccess: (updatedTripFromServer) => {
          if (this.trip)
            this.trip = { ...this.trip, ...updatedTripFromServer }
          useToast().success('Информация о путешествии обновлена.')
        },
        onError: createApiErrorHandler({
          handlers: {
            custom: () => {
              this.trip = originalTrip
            },
          },
        }),
      })
    },

    async addParticipant(userId: string) {
      if (!this.trip)
        return

      await useRequest({
        key: ETripPlanKeys.ADD_PARTICIPANT,
        fn: db => db.trips.addParticipant(this.trip!.id, userId),
        onSuccess: () => {
          useToast().success(`Участник успешно добавлен в путешествие`)
          this.fetchTripDetails(this.trip!.id, this.currentDayId!, () => { })
        },
      })
    },

    updateDayDetails(dayId: string, details: Partial<Pick<IDay, 'title' | 'description' | 'date' | 'meta'>>) {
      const dayIndex = this.days.findIndex(d => d.id === dayId)
      if (dayIndex === -1) {
        console.error('Не удалось найти день для обновления:', dayId)
        useToast().error(`Не удалось найти день для обновления`)
        return
      }
      const originalDay = { ...this.days[dayIndex] }

      Object.assign(this.days[dayIndex], details)

      if (details.date)
        this.days.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      useRequest({
        key: ETripPlanKeys.UPDATE_DAY,
        fn: db => db.days.updateDayDetails(dayId, details),
        onSuccess: (updatedDayFromServer) => {
          const finalDayIndex = this.days.findIndex(d => d.id === dayId)
          if (finalDayIndex !== -1)
            this.days[finalDayIndex] = { ...this.days[finalDayIndex], ...updatedDayFromServer }
        },
        onError: ({ error }) => {
          const dayToRevertIndex = this.days.findIndex(d => d.id === dayId)
          if (dayToRevertIndex !== -1)
            this.days[dayToRevertIndex] = originalDay

          if (details.date)
            this.days.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

          console.error(`Ошибка при обновлении дня ${dayId}: `, error)
          useToast().error(`Ошибка при обновлении дня: ${error.customMessage}`)
        },
      })
    },

    addActivity(dayId: string, activityData: Omit<IActivity, 'id'>) {
      const day = this.days.find(d => d.id === dayId)
      if (!day) {
        console.error('Не удалось найти день для добавления активности:', dayId)
        useToast().error(`Не удалось найти день для добавления активности`)
        return
      }

      const tempId = `temp-activity-${Date.now()}`
      const optimisticActivity: IActivity = {
        ...activityData,
        id: tempId,
      }

      day.activities.push(optimisticActivity)

      useRequest({
        key: `${ETripPlanKeys.ADD_ACTIVITY}:${tempId}`,
        fn: db => db.activities.create(activityData),
        onSuccess: (createdActivityFromServer) => {
          const tempActivity = day.activities.find(a => a.id === tempId)
          if (tempActivity) {
            Object.assign(tempActivity, createdActivityFromServer)
          }
          console.log(`Активность ${createdActivityFromServer.id} успешно создана.`)
        },
        onError: ({ error }) => {
          const activityIndex = day.activities.findIndex(a => a.id === tempId)
          if (activityIndex !== -1) {
            day.activities.splice(activityIndex, 1)
          }

          console.error(`Ошибка при создании активности: `, error)
          useToast().error(`Ошибка при создании активности: ${error.customMessage}`)
        },
      })
    },

    removeActivity(dayId: string, activityId: string) {
      const day = this.days.find(d => d.id === dayId)
      if (!day) {
        console.error('Не удалось найти день для удаления активности:', dayId)
        useToast().error(`Не удалось найти день для удаления активности.`)
        return
      }

      const activityIndex = day.activities.findIndex(a => a.id === activityId)
      if (activityIndex === -1) {
        console.error('Не удалось найти активность для удаления:', activityId)
        useToast().error(`Не удалось найти активность для удаления.`)
        return
      }

      const removedActivity = day.activities.splice(activityIndex, 1)[0]

      useRequest({
        key: `${ETripPlanKeys.REMOVE_ACTIVITY}:${activityId}`,
        fn: db => db.activities.remove(activityId),
        onSuccess: () => {
          console.log(`Активность ${activityId} успешно удалена с сервера.`)
        },
        onError: ({ error }) => {
          if (day)
            day.activities.splice(activityIndex, 0, removedActivity)

          console.error(`Ошибка при удалении активности ${activityId}: `, error)
          useToast().error(`Ошибка при удалении активности: ${error.customMessage}`)
        },

      })
    },

    updateActivity(dayId: string, updatedActivity: IActivity) {
      const day = this.days.find(d => d.id === dayId)
      if (!day)
        return

      const activityIndex = day.activities.findIndex(a => a.id === updatedActivity.id)
      if (activityIndex === -1)
        return

      const originalActivity = JSON.parse(JSON.stringify(day.activities[activityIndex]))
      day.activities[activityIndex] = updatedActivity

      if (updatedActivity.id.startsWith('new-ai-')) {
        this.setActivityDraft(updatedActivity.id, updatedActivity)
        return
      }

      useRequest({
        key: `${ETripPlanKeys.UPDATE_ACTIVITY}:${updatedActivity.id}`,
        fn: db => db.activities.update(updatedActivity),
        onSuccess: (activityFromServer) => {
          const finalIndex = day.activities.findIndex(a => a.id === activityFromServer.id)

          if (finalIndex !== -1)
            day.activities[finalIndex] = activityFromServer
        },
        onError: ({ error }) => {
          const revertIndex = day.activities.findIndex(a => a.id === updatedActivity.id)
          if (revertIndex !== -1)
            day.activities[revertIndex] = originalActivity

          console.error(`Ошибка при обновлении активности ${updatedActivity.id}: `, error)
          useToast().error(`Ошибка при обновлении активности: ${error.customMessage}`)
        },
      })
    },

    addNewDay() {
      if (!this.currentTripId) {
        console.error('Невозможно добавить день: ID путешествия не установлен.')
        useToast().error(`Невозможно добавить день: ID путешествия не установлен.`)
        return
      }

      const lastDay = [...this.days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).pop()
      const newDate = lastDay ? new Date(lastDay.date) : new Date()

      if (lastDay)
        newDate.setDate(newDate.getDate() + 1)

      const newDayData: Omit<IDay, 'id'> = {
        tripId: this.currentTripId,
        title: `День ${this.days.length + 1}`,
        description: '',
        date: newDate.toISOString(),
        activities: [],
      }

      const tempId = `temp-day-${Date.now()}`
      const dayWithTempId = { ...newDayData, id: tempId }

      this.days.push(dayWithTempId as IDay)
      this.days.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      this.currentDayId = tempId

      useRequest({
        key: ETripPlanKeys.ADD_DAY,
        fn: db => db.days.createNewDay(newDayData),
        onSuccess: (createdDay) => {
          const tempDayIndex = this.days.findIndex(d => d.id === tempId)
          if (tempDayIndex !== -1) {
            this.days[tempDayIndex] = { ...this.days[tempDayIndex], ...createdDay } as IDay
            if (this.currentDayId === tempId)
              this.currentDayId = createdDay.id
          }
        },
        onError: ({ error }) => {
          const tempDayIndex = this.days.findIndex(d => d.id === tempId)
          if (tempDayIndex !== -1)
            this.days.splice(tempDayIndex, 1)

          if (this.currentDayId === tempId)
            this.currentDayId = this.days.length > 0 ? this.days[this.days.length - 1].id : null

          console.error('Ошибка при добавлении нового дня:', error)
          useToast().error(`Ошибка при добавлении нового дня: ${error.customMessage}`)
        },
      })
    },

    deleteDay() {
      if (!this.currentDayId) {
        console.error('Невозможно удалить день: день не выбран.')
        useToast().error(`Невозможно удалить день: день не выбран.`)
        return
      }

      const dayIdToDelete = this.currentDayId
      const dayIndex = this.days.findIndex(d => d.id === dayIdToDelete)
      if (dayIndex === -1) {
        console.error('Не удалось найти день для удаления:', dayIdToDelete)
        useToast().error(`Не удалось найти день для удаления.`)
        return
      }

      const deletedDay = this.days[dayIndex]
      const originalCurrentDayId = this.currentDayId

      this.days.splice(dayIndex, 1)

      if (this.days.length > 0) {
        const newIndex = Math.min(dayIndex, this.days.length - 1)
        this.currentDayId = this.days[newIndex].id
      }
      else {
        this.currentDayId = null
      }

      useRequest({
        key: ETripPlanKeys.DELETE_DAY,
        fn: db => db.days.deleteDay(dayIdToDelete),
        onSuccess: () => {
          console.log(`День ${dayIdToDelete} успешно удален с сервера.`)
        },
        onError: ({ error }) => {
          this.days.splice(dayIndex, 0, deletedDay)
          this.currentDayId = originalCurrentDayId

          console.error(`Ошибка при удалении дня ${dayIdToDelete}: `, error)
          useToast().error(`Ошибка при удалении дня: ${error.customMessage}`)
        },
      })
    },

    async deleteCurrentTrip() {
      if (!this.trip)
        return

      const tripId = this.trip.id
      const router = useRouter()

      return useRequest({
        key: `${ETripPlanKeys.DELETE_TRIP}:${tripId}`,
        fn: db => db.trips.delete(tripId),
        onSuccess: () => {
          useToast().success('Путешествие успешно удалено.')
          router.push(AppRoutePaths.Trip.List)
        },
        onError: ({ error }) => {
          useToast().error(`Не удалось удалить путешествие: ${error.customMessage}`)
          throw error
        },
      })
    },

    reorderActivities(newOrder: IActivity[]) {
      const day = this.days.find(d => d.id === this.currentDayId)
      if (!day)
        return

      if (newOrder.length === 0) {
        day.activities = []
        return
      }

      const originalSortedActivities = this.getActivitiesForSelectedDay
      const anchorStartTimeMinutes = originalSortedActivities.length > 0
        ? timeToMinutes(originalSortedActivities[0].startTime)
        : 9 * 60

      const GAP_BETWEEN_ACTIVITIES_MINUTES = 15
      const recalculatedActivities: IActivity[] = []
      let lastEndTimeMinutes = anchorStartTimeMinutes - GAP_BETWEEN_ACTIVITIES_MINUTES

      for (const activity of newOrder) {
        const duration = timeToMinutes(activity.endTime) - timeToMinutes(activity.startTime)
        const newStartTimeMinutes = lastEndTimeMinutes + GAP_BETWEEN_ACTIVITIES_MINUTES
        const newEndTimeMinutes = newStartTimeMinutes + duration

        recalculatedActivities.push({
          ...activity,
          startTime: minutesToTime(newStartTimeMinutes),
          endTime: minutesToTime(newEndTimeMinutes),
        })

        lastEndTimeMinutes = newEndTimeMinutes
      }

      day.activities = recalculatedActivities
      // TODO: Отправить batch-запрос на обновление на бэкенд
    },

    async fetchDayNote(dayId: string) {
      if (this.dayNote.has(dayId))
        return

      await useRequest({
        key: ETripPlanKeys.FETCH_DAY_NOTE,
        fn: db => db.days.getNote({ dayId }),
        onSuccess: (data) => {
          this.dayNote.set(dayId, data || '')
        },
      })
    },

    async updateDayNote(dayId: string, noteContent: string) {
      this.dayNote.set(dayId, noteContent)

      await useRequest({
        key: ETripPlanKeys.UPDATE_DAY_NOTE,
        fn: db => db.days.updateDayDetails(dayId, { note: noteContent }),
        onError: () => {
          useToast().error('Ошибка при сохранении заметки')
        },
      })
    },

    setPreviewMode(value: boolean) {
      this.isPreviewMode = value
    },

    acceptActivityDraftFields(dayId: string, activityId: string, fields: string[]) {
      if (activityId.startsWith('new-ai-')) {
        this.acceptActivityDraft(dayId, activityId)
        return
      }

      const day = this.days.find(d => d.id === dayId)
      if (!day) return

      const originalActivity = day.activities.find(a => a.id === activityId)
      if (!originalActivity) return

      const draft = this.activityDrafts.get(activityId)
      if (!draft) return

      const updatedActivity = { ...originalActivity }

      if (fields.includes('title')) updatedActivity.title = draft.title
      if (fields.includes('time')) {
        updatedActivity.startTime = draft.startTime
        updatedActivity.endTime = draft.endTime
      }
      if (fields.includes('tag')) updatedActivity.tag = draft.tag
      if (fields.includes('sections')) {
        updatedActivity.sections = draft.sections ? JSON.parse(JSON.stringify(draft.sections)) : []
      }

      this.updateActivity(dayId, updatedActivity)

      const updatedDraft = { ...draft }
      if (fields.includes('title')) updatedDraft.title = updatedActivity.title
      if (fields.includes('time')) {
        updatedDraft.startTime = updatedActivity.startTime
        updatedDraft.endTime = updatedActivity.endTime
      }
      if (fields.includes('tag')) updatedDraft.tag = updatedActivity.tag
      if (fields.includes('sections')) {
        updatedDraft.sections = updatedActivity.sections ? JSON.parse(JSON.stringify(updatedActivity.sections)) : []
      }

      // Recalculate remaining diff
      const diff = useActivityDiff(updatedActivity, updatedDraft)
      if (!diff.hasChanges) {
        this.activityDrafts.delete(activityId)
      } else {
        this.activityDrafts.set(activityId, updatedDraft)
      }

      if (this.activityDrafts.size === 0) {
        this.isPreviewMode = false
      }
    },

    reset() {
      this.trip = null
      this.days = []
      this.currentTripId = null
      this.currentDayId = null
      this.dayNote.clear()
      this.isPreviewMode = false

      const requestStore = useRequestStore()
      Object.values(ETripPlanKeys).forEach(key => requestStore.reset(key))
    },
  },
})
