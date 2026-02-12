import type { Activity } from '~/shared/types/models/activity'
import type { CreateMemoryInput, Memory, UpdateMemoryInput } from '~/shared/types/models/memory'
import type { TripImage } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { useTripPlanStore } from '~/components/04.features/trip-info/trip-plan'
import { useAbortRequest, useRequest, useRequestStatus } from '~/plugins/request'
import { getLocalDate } from '~/shared/lib/date-time'
import { resolveApiUrl } from '~/shared/lib/url'
import { TripImagePlacement } from '~/shared/types/models/trip'

export interface IProcessingMemory {
  tempId: string
  file: File
  previewUrl: string
  status: 'queued' | 'uploading' | 'error' | 'success'
  progress: number
  error?: string
}

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

  localBlobUrls: Map<string, string>
  isLocalModeEnabled: boolean
  downloadProgress: {
    current: number
    total: number
    loadedBytes: number
    isDownloading: boolean
  }
}

export const useTripMemoriesStore = defineStore('tripMemories', {
  state: (): ITripInfoMemoriesState => ({
    memories: [],
    processingMemories: new Map(),
    currentTripId: null,

    localBlobUrls: new Map(),
    isLocalModeEnabled: false,
    downloadProgress: { current: 0, total: 0, loadedBytes: 0, isDownloading: false },
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
      if (!selectedDay)
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
      return this.memoriesForSelectedDay.filter(
        (m): m is Memory & { image: TripImage & { latitude: number, longitude: number } } =>
          !!m.image?.latitude && !!m.image?.longitude,
      )
    },

    canEnableLocalMode(state): boolean {
      return state.localBlobUrls.size > 0
    },
  },

  actions: {
    fetchMemories(tripId: string) {
      if (this.currentTripId === tripId && this.memories.length > 0)
        return

      this.currentTripId = tripId

      useRequest<Memory[]>({
        key: ETripMemoriesKeys.FETCH,
        abortOnUnmount: true,
        fn: db => db.memories.getByTripId(tripId),
        onSuccess: (result) => {
          this.memories = result
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

    enqueueFilesForUpload(files: File[]) {
      const tripPlanStore = useTripPlanStore()
      if (!tripPlanStore.currentTripId) {
        console.error('Trip ID не установлен для загрузки.')
        return
      }

      files.forEach((file) => {
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

      this._processUploadQueue()
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
        processingItem.progress = 0
      }

      await useRequest<Memory>({
        key: requestKey,
        fn: async (db, signal) => {
          const onProgress = (progress: number) => {
            const currentItem = this.processingMemories.get(tempId)
            if (currentItem)
              currentItem.progress = progress
          }

          const newImage = await db.files.uploadFileWithProgress(
            file,
            tripId,
            'trip',
            TripImagePlacement.MEMORIES,
            onProgress,
            signal,
          )

          const selectedDay = tripPlanStore.getSelectedDay
          const getTimestamp = () => {
            if (!newImage.takenAt)
              return null
            const imageDate = (newImage.metadata?.timezoneOffset)
              ? getLocalDate(newImage.takenAt, newImage.metadata?.timezoneOffset)
              : new Date(newImage.takenAt)
            const imageDateStr = imageDate.toISOString().split('T')[0]

            if (!selectedDay)
              return null
            const selectedDayStr = new Date(selectedDay.date).toISOString().split('T')[0]

            return imageDateStr === selectedDayStr ? imageDate.toISOString() : null
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
          this._processUploadQueue()
        },
        onError: ({ error }) => {
          console.error(`Ошибка при загрузке (tempId: ${tempId}):`, error)

          const pItem = this.processingMemories.get(tempId)

          if (pItem) {
            pItem.status = 'error'
            pItem.progress = 0
            pItem.error = error.customMessage
          }
          this._processUploadQueue()
        },
        onAbort: () => {
          URL.revokeObjectURL(previewUrl)
          this.processingMemories.delete(tempId)
          this._processUploadQueue()
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
        this._processUploadQueue()
      }
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
      if (!tripId || !day)
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

    async downloadAllPhotosToFolder() {
      if (!('showDirectoryPicker' in window)) {
        useToast().error(`Ваш браузер не поддерживает сохранение в папки (File System Access API). Используйте Chrome, Edge или Opera на десктопе.`)
        return
      }

      const photosToDownload = this.memoriesForSelectedDay.filter(m => !!m.image)
      if (photosToDownload.length === 0)
        return

      try {
        // @ts-expect-error - File System Access API types
        const dirHandle = await window.showDirectoryPicker()

        this.downloadProgress.isDownloading = true
        this.downloadProgress.total = photosToDownload.length
        this.downloadProgress.current = 0
        this.downloadProgress.loadedBytes = 0

        for (const memory of photosToDownload) {
          if (!memory.image || !memory.image.url)
            continue

          try {
            // 1. Получаем абсолютный URL через хелпер, чтобы запрос ушел на сервер API, а не на клиент
            const url = resolveApiUrl(memory.image.url)

            // 2. Скачиваем Blob
            const response = await fetch(url)
            if (!response.ok)
              throw new Error(`Failed to fetch ${url}`)

            const blob = await response.blob()
            this.downloadProgress.loadedBytes += blob.size

            // 3. Формируем имя файла
            // Формат: YYYY-MM-DD_HH-mm-ss_ID.ext
            let filename = `photo_${memory.id.slice(0, 8)}.jpg`

            if (memory.timestamp) {
              const date = new Date(memory.timestamp)
              const dateStr = date.toISOString().split('T')[0]
              const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-')
              filename = `${dateStr}_${timeStr}_${memory.id.slice(0, 5)}.jpg`
            }

            // Определяем расширение из MIME типа, если возможно
            const mimeType = blob.type
            if (mimeType === 'image/png')
              filename = filename.replace('.jpg', '.png')
            else if (mimeType === 'image/webp')
              filename = filename.replace('.jpg', '.webp')
            else if (mimeType === 'image/jpeg')
              filename = filename.replace('.png', '.jpg') // normalize

            // 4. Сохраняем файл на диск
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
            const writable = await fileHandle.createWritable()
            await writable.write(blob)
            await writable.close()

            // 5. Сохраняем Blob URL для локального режима
            if (memory.imageId) {
              // Если уже был URL для этого ID, освобождаем память
              if (this.localBlobUrls.has(memory.imageId)) {
                URL.revokeObjectURL(this.localBlobUrls.get(memory.imageId)!)
              }
              const localUrl = URL.createObjectURL(blob)
              this.localBlobUrls.set(memory.imageId, localUrl)
            }
          }
          catch (e) {
            console.error(`Failed to download photo ${memory.id}`, e)
          }
          finally {
            this.downloadProgress.current++
          }
        }

        // Автоматически включаем локальный режим, если скачали что-то
        if (this.localBlobUrls.size > 0) {
          this.isLocalModeEnabled = true
          useToast().success(`Успешно скачано ${this.downloadProgress.current} фото. Включен локальный режим просмотра.`)
        }
      }
      catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Download error:', err)
          useToast().error('Ошибка при скачивании фотографий.')
        }
      }
      finally {
        this.downloadProgress.isDownloading = false
      }
    },

    toggleLocalMode() {
      if (this.localBlobUrls.size === 0 && !this.isLocalModeEnabled) {
        useToast().info('Нет скачанных локально фотографий.')
        return
      }
      this.isLocalModeEnabled = !this.isLocalModeEnabled
    },

    reset() {
      this.getProcessingMemories.forEach(p => this.cancelMemoryUpload(p.tempId))

      // Очистка Blob URLs
      this.localBlobUrls.forEach(url => URL.revokeObjectURL(url))
      this.localBlobUrls.clear()
      this.isLocalModeEnabled = false
      this.downloadProgress = { current: 0, total: 0, loadedBytes: 0, isDownloading: false }

      this.memories = []
      this.processingMemories.clear()
      this.currentTripId = null
    },
  },
})
