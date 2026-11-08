import type { IProcessingMemory, TimelineGroup } from '../types'
import type { Activity } from '~/shared/types/models/activity'
import type { CreateMemoryInput, Memory, UpdateMemoryInput } from '~/shared/types/models/memory'
import type { TripMedia } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { useTripPlanStore } from '~/components/04.features/trip-info/trip-plan'
import { useAbortRequest, useRequest, useRequestStatus, useRequestStore } from '~/plugins/request'
import { getLocalDate } from '~/shared/lib/date-time'
import { useOfflineStore } from '~/shared/store/offline.store'
import { TripMediaPlacement } from '~/shared/types/models/trip'

export enum ETripMemoriesKeys {
  FETCH = 'memories:fetch',
  CREATE = 'memories:create',
  UPDATE = 'memories:update',
  DELETE = 'memories:delete',
  UPLOAD = 'memories:upload',
  APPLY_TIMESTAMP = 'memories:apply-timestamp',
  REMOVE_TIMESTAMP = 'memories:remove-timestamp',
}

export interface ITripInfoMemoriesState {
  memories: Memory[]
  processingMemories: Map<string, IProcessingMemory>
  currentTripId: string | null
}

export const useTripMemoriesStore = defineStore('tripMemories', {
  state: (): ITripInfoMemoriesState => ({
    memories: [],
    processingMemories: new Map(),
    currentTripId: null,
  }),

  getters: {
    isLoadingMemories: () => useRequestStatus(ETripMemoriesKeys.FETCH).value,
    isCreatingMemory: () => useRequestStatus(ETripMemoriesKeys.CREATE).value,
    isMutateMemory: () => useRequestStatus([
      ETripMemoriesKeys.UPDATE,
      ETripMemoriesKeys.DELETE,
      ETripMemoriesKeys.REMOVE_TIMESTAMP,
      ETripMemoriesKeys.APPLY_TIMESTAMP,
    ]).value,

    getProcessingMemories(state): IProcessingMemory[] {
      return Array.from(state.processingMemories.values())
    },

    memoriesForSelectedDay(state): Memory[] {
      const tripPlanStore = useTripPlanStore()
      const selectedDay = tripPlanStore.getSelectedDay

      if (!selectedDay || !selectedDay.date)
        return []

      const selectedDateStr = new Date(selectedDay.date).toISOString().split('T')[0]

      return state.memories
        .filter((m) => {
          if (!m.timestamp)
            return false

          const memoryDateStr = m.timestamp.split('T')[0]

          return memoryDateStr === selectedDateStr
        })
        .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())
    },

    memoriesToProcess(state): Memory[] {
      return state.memories.filter(m => m.imageId && !m.timestamp)
    },

    memoriesWithGeoForSelectedDay(): Memory[] {
      return this.memoriesForSelectedDay.filter((m): m is Memory & { image: TripMedia & { latitude: number, longitude: number } } =>
        !!m.image?.latitude && !!m.image?.longitude)
    },

    timelineGroupsForSelectedDay(): TimelineGroup[] {
      const memoriesList = this.memoriesForSelectedDay

      if (!memoriesList.length)
        return []

      const groups: TimelineGroup[] = []
      let currentGroup: TimelineGroup | null = null

      const ensureStartGroup = (): TimelineGroup => {
        let startGroup = groups.find(g => g.type === 'start')

        if (!startGroup) {
          startGroup = { type: 'start', title: '', memories: [], activity: null }
          groups.unshift(startGroup)
        }

        return startGroup
      }

      for (const memory of memoriesList) {
        if (memory.title) {
          currentGroup = { type: 'activity', activity: memory, title: memory.title, memories: [] }

          if (memory.imageId || memory.comment)
            currentGroup.memories.push(memory)

          groups.push(currentGroup)
        }
        else if (currentGroup) {
          currentGroup.memories.push(memory)
        }
        else {
          ensureStartGroup().memories.push(memory)
        }
      }

      const startGroup = groups.find(g => g.type === 'start')

      if (startGroup && startGroup.memories.length === 0)
        return groups.filter(g => g.type !== 'start')

      return groups
    },
  },

  actions: {
    fetchMemories(tripId: string) {
      if (this.currentTripId === tripId && this.memories.length > 0)
        return

      this.currentTripId = tripId
      const offlineStore = useOfflineStore()

      useRequest<Memory[]>({
        key: ETripMemoriesKeys.FETCH,
        abortOnUnmount: true,
        fn: db => db.memories.getByTripId(tripId),
        onSuccess: (result) => {
          this.memories = result
        },
        onError: () => {
          if (offlineStore.isTripCached(tripId)) {
            this.memories = offlineStore.getSavedTripMemories(tripId)
            const requestStore = useRequestStore()
            requestStore.setError(ETripMemoriesKeys.FETCH, null)
            requestStore.setStatus(ETripMemoriesKeys.FETCH, 'success')
            useToast().info('Нет подключения к сети. Загружены офлайн-воспоминания.')
          }
        },
      })
    },

    async _processUploadQueue() {
      const isUploading = this.getProcessingMemories.some(p => p.status === 'uploading')

      if (isUploading)
        return

      const nextToUpload = this.getProcessingMemories.find(p => p.status === 'queued')

      if (nextToUpload)
        await this.uploadMemoryImage(nextToUpload)
    },

    addFilesToUploadQueue(files: File[]) {
      const tripPlanStore = useTripPlanStore()

      if (!tripPlanStore.currentTripId) {
        console.error('Trip ID не установлен для загрузки.')

        return
      }

      files.forEach((file) => {
        const isAlreadyInQueue = this.getProcessingMemories.some(item => item.file.name === file.name && item.file.size === file.size)

        if (isAlreadyInQueue)
          return

        const isAlreadyInMemories = this.memories.some((memory) => {
          const img = memory.image

          if (!img)
            return false

          const sameName = (img.originalName && img.originalName === file.name) || (img.name && img.name === file.name)
          const technicalFileSize = (img.metadata as { technical?: { fileSize?: number } } | null | undefined)?.technical?.fileSize
          const sameSize = img.sizeBytes === file.size || technicalFileSize === file.size

          return Boolean(sameName && sameSize)
        })

        if (isAlreadyInMemories)
          return

        const tempId = uuidv4()
        const previewUrl = URL.createObjectURL(file)
        this.processingMemories.set(tempId, {
          tempId,
          file,
          previewUrl,
          status: 'queued',
          progress: 0,
        })
      })

      void this._processUploadQueue()
    },

    enqueueFilesForUpload(files: File[]) {
      this.addFilesToUploadQueue(files)
    },

    async uploadMemoryImage(item: IProcessingMemory) {
      const tripPlanStore = useTripPlanStore()
      const tripId = tripPlanStore.currentTripId

      if (!tripId) {
        console.error('Trip ID не установлен.')

        return
      }

      const { tempId, file, previewUrl } = item
      const requestKey = `${ETripMemoriesKeys.UPLOAD}:${tempId}`

      const processingItem = this.processingMemories.get(tempId)

      if (processingItem) {
        processingItem.status = 'uploading'
        processingItem.progress = processingItem.uploadedImage ? 100 : 0
      }

      await useRequest<Memory>({
        key: requestKey,
        fn: async (db, signal) => {
          const onProgress = (progress: number) => {
            const currentItem = this.processingMemories.get(tempId)

            if (currentItem)
              currentItem.progress = progress
          }

          const currentItem = this.processingMemories.get(tempId)
          let newImage = currentItem?.uploadedImage ?? item.uploadedImage

          if (!newImage) {
            newImage = await db.files.uploadFileWithProgress(
              file,
              tripId,
              'trip',
              TripMediaPlacement.MEMORIES,
              onProgress,
              signal,
            )

            const latestItem = this.processingMemories.get(tempId)

            if (latestItem) {
              latestItem.uploadedImage = newImage
            }

            item.uploadedImage = newImage
          }
          else {
            onProgress(100)
          }

          const getTimestamp = () => {
            if (!newImage.takenAt)
              return null

            const imageDate = (newImage.metadata?.timezoneOffset)
              ? getLocalDate(newImage.takenAt, newImage.metadata?.timezoneOffset)
              : new Date(newImage.takenAt)

            if (Number.isNaN(imageDate.getTime()))
              return null

            const imageDateStr = imageDate.toISOString().split('T')[0]
            const allDays = tripPlanStore.days?.length
              ? tripPlanStore.days
              : (tripPlanStore.getSelectedDay ? [tripPlanStore.getSelectedDay] : [])

            const matchesAnyTripDay = allDays.some((day) => {
              if (!day?.date)
                return false

              const dayDateStr = new Date(day.date).toISOString().split('T')[0]

              return dayDateStr === imageDateStr
            })

            return matchesAnyTripDay ? imageDate.toISOString() : null
          }

          return await db.memories.create({
            tripId,
            imageId: newImage.id,
            timestamp: getTimestamp(),
          })
        },
        onSuccess: (newMemory) => {
          this.memories.push(newMemory)
          URL.revokeObjectURL(previewUrl)
          this.processingMemories.delete(tempId)
          void this._processUploadQueue()
        },
        onError: ({ error }) => {
          console.error(`Ошибка при загрузке (tempId: ${tempId}):`, error)

          const pItem = this.processingMemories.get(tempId)

          if (pItem) {
            pItem.status = 'error'
            pItem.progress = pItem.uploadedImage ? 100 : 0
            pItem.error = error.customMessage
          }

          void this._processUploadQueue()
        },
        onAbort: () => {
          URL.revokeObjectURL(previewUrl)
          this.processingMemories.delete(tempId)
          void this._processUploadQueue()
        },
      })
    },

    cancelMemoryUpload(tempId: string) {
      const { abort } = useAbortRequest()
      const requestKey = `${ETripMemoriesKeys.UPLOAD}:${tempId}`
      abort(requestKey)
    },

    retryMemoryUpload(tempId: string) {
      const processingItem = this.processingMemories.get(tempId)

      if (processingItem && processingItem.status === 'error') {
        processingItem.status = 'queued'
        processingItem.error = undefined
        void this._processUploadQueue()
      }
    },

    retryAllFailedUploads() {
      let hasRetried = false

      for (const item of this.processingMemories.values()) {
        if (item.status === 'error') {
          item.status = 'queued'
          item.error = undefined
          hasRetried = true
        }
      }

      if (hasRetried)
        void this._processUploadQueue()
    },

    removeProcessingMemory(tempId: string) {
      const item = this.processingMemories.get(tempId)

      if (item) {
        if (item.status === 'uploading')
          this.cancelMemoryUpload(tempId)
        else
          this.processingMemories.delete(tempId)
      }
    },

    async createMemory(data: CreateMemoryInput) {
      await useRequest({
        key: ETripMemoriesKeys.CREATE,
        fn: db => db.memories.create(data),
        onSuccess: (newMemory) => {
          this.memories.push(newMemory)
        },
      })
    },

    async importActivityFromPlan(activity: Activity) {
      const tripPlanStore = useTripPlanStore()
      const tripId = tripPlanStore.currentTripId
      const day = tripPlanStore.getSelectedDay

      if (!tripId || !day || !day.date)
        return

      const datePart = day.date.split('T')[0]
      const timePart = `${activity.startTime}:00`
      const timestamp = `${datePart}T${timePart}.000Z`

      await this.createMemory({
        tripId,
        title: activity.title,
        tag: activity.tag,
        timestamp,
        sourceActivityId: activity.id,
      })
    },

    async updateMemory(data: UpdateMemoryInput) {
      const memory = this.memories.find(m => m.id === data.id)

      if (!memory)
        return

      const originalMemory = { ...memory }
      Object.assign(memory, data)

      await useRequest({
        key: ETripMemoriesKeys.UPDATE,
        fn: db => db.memories.update(data),
        onError: () => {
          Object.assign(memory, originalMemory)
        },
      })
    },

    async deleteMemory(id: string) {
      const index = this.memories.findIndex(m => m.id === id)

      if (index > -1) {
        const [removedMemory] = this.memories.splice(index, 1)
        await useRequest({
          key: ETripMemoriesKeys.DELETE,
          fn: db => db.memories.delete(id),
          onError: () => {
            this.memories.splice(index, 0, removedMemory)
          },
        })
      }
    },

    async applyOriginalTimestamp(memoryId: string) {
      const memory = this.memories.find(m => m.id === memoryId)

      if (!memory || !memory.imageId)
        return

      const originalMemory = { ...memory }

      await useRequest({
        key: ETripMemoriesKeys.APPLY_TIMESTAMP,
        fn: db => db.memories.applyTakenAtTimestamp(memoryId),
        onSuccess: (updatedMemory) => {
          if (updatedMemory)
            Object.assign(memory, updatedMemory)
        },
        onError: () => {
          Object.assign(memory, originalMemory)
        },
      })
    },

    async removeTimestamp(memoryId: string) {
      const memory = this.memories.find(m => m.id === memoryId)

      if (!memory)
        return

      const originalTimestamp = memory.timestamp
      memory.timestamp = null

      await useRequest({
        key: ETripMemoriesKeys.REMOVE_TIMESTAMP,
        fn: db => db.memories.unassignTimestamp(memoryId),
        onError: () => {
          memory.timestamp = originalTimestamp
        },
      })
    },

    async downloadAllPhotosToLocal() {
      // Этот метод можно использовать для скачивания вообще всего трипа,
      // но пока логика реализована на уровне Дня в useTripMemoriesVault.
      // Оставляем пустым или переносим логику туда.
    },

    toggleLocalMode() {
      // TODO
    },

    reset() {
      this.getProcessingMemories.forEach(p => this.cancelMemoryUpload(p.tempId))

      this.memories = []
      this.processingMemories.clear()
      this.currentTripId = null
    },
  },
})
