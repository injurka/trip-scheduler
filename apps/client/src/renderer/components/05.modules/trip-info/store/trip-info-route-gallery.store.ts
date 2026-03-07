import type { TripImage } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { TripImagePlacement } from '~/shared/types/models/trip'

export enum ETripGalleryKeys {
  FETCH_IMAGES = 'gallery:fetch-images',
  UPLOAD_IMAGE = 'gallery:upload-image',
}

export interface ITripInfoGalleryState {
  tripImages: TripImage[]
  currentTripId: string | null
  loadedTripId: string | null
}

/**
 * Стор для управления галереей и изображениями на странице путешествия.
 */
export const useTripInfoGalleryStore = defineStore('tripInfoRouteGallery', {
  state: (): ITripInfoGalleryState => ({
    tripImages: [],
    currentTripId: null,
    loadedTripId: null,
  }),

  getters: {
    isFetchingImages: () => useRequestStatus(ETripGalleryKeys.FETCH_IMAGES).value,
    isUploadingImage: () => useRequestStatus(ETripGalleryKeys.UPLOAD_IMAGE).value,
  },

  actions: {
    /**
     * Устанавливает ID текущего путешествия и сбрасывает состояние,
     * если ID изменился.
     * @param tripId - ID путешествия
     */
    setTripId(tripId: string) {
      if (this.currentTripId !== tripId) {
        this.currentTripId = tripId
        this.loadedTripId = null
        this.tripImages = []
      }
    },

    /**
     * Загружает изображения для текущего путешествия.
     * Не выполняет запрос, если данные уже загружены для этого ID.
     */
    async fetchTripImages() {
      if (!this.currentTripId) {
        console.error('Trip ID не установлен для загрузки изображений.')
        return
      }

      if (this.currentTripId === this.loadedTripId || this.isFetchingImages) {
        return
      }

      await useRequest<TripImage[]>({
        key: ETripGalleryKeys.FETCH_IMAGES,
        abortOnUnmount: true,
        fn: db => db.files.listImageByTrip(this.currentTripId!, TripImagePlacement.ROUTE),
        onSuccess: (result) => {
          this.tripImages = result
          this.loadedTripId = this.currentTripId
        },
        onError: ({ error }) => {
          console.error(`Ошибка при загрузке изображений для путешествия ${this.currentTripId}:`, error.customMessage)
        },
      })
    },

    /**
     * Загружает новое изображение в галерею путешествия.
     * @param file - Загружаемый файл
     * @returns Promise с загруженным изображением или null в случае ошибки.
     */
    async uploadImage(file: File): Promise<TripImage | null> {
      if (!this.currentTripId) {
        console.error('Trip ID не установлен для загрузки изображения.')
        return null
      }

      const newImage = await useRequest<TripImage>({
        key: ETripGalleryKeys.UPLOAD_IMAGE,
        fn: db => db.files.uploadFile(
          file,
          this.currentTripId!,
          'trip',
          TripImagePlacement.ROUTE,
        ),
        onSuccess: (result) => {
          this.tripImages.push(result)
        },
        onError: ({ error }) => {
          console.error(`Ошибка при загрузке изображения для путешествия ${this.currentTripId}:`, error.customMessage)
        },
      })

      return newImage
    },

    /**
     * Сбрасывает состояние стора к исходному.
     */
    reset() {
      this.tripImages = []
      this.currentTripId = null
      this.loadedTripId = null
    },
  },
})
