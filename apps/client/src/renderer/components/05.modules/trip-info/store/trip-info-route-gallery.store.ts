import type { TripImage } from '~/shared/types/models/trip'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { TripImagePlacement } from '~/shared/types/models/trip'

export enum ETripGalleryKeys {
  FETCH_IMAGES = 'gallery:fetch-images',
  UPLOAD_IMAGE = 'gallery:upload-image',
}

export interface ITripInfoGalleryState {
  tripImages: TripImage[]
  currentTripId: string | null
}

/**
 * Стор для управления галереей и изображениями на странице путешествия.
 */
export const useTripInfoGalleryStore = defineStore('tripInfoRouteGallery', {
  // --- STATE ---
  state: (): ITripInfoGalleryState => ({
    tripImages: [],
    currentTripId: null,
  }),

  // --- GETTERS ---
  getters: {
    isFetchingImages: () => useRequestStatus(ETripGalleryKeys.FETCH_IMAGES).value,
    isUploadingImage: () => useRequestStatus(ETripGalleryKeys.UPLOAD_IMAGE).value,
  },

  // --- ACTIONS ---
  actions: {
    /**
     * Устанавливает ID текущего путешествия и запускает загрузку изображений,
     * если ID изменился.
     * @param tripId - ID путешествия
     */
    setTripId(tripId: string) {
      if (this.currentTripId !== tripId) {
        this.currentTripId = tripId
        this.tripImages = []
      }
    },

    /**
     * Загружает изображения для текущего путешествия.
     */
    async fetchTripImages() {
      if (!this.currentTripId) {
        console.error('Trip ID не установлен для загрузки изображений.')
        return
      }

      await useRequest<TripImage[]>({
        key: ETripGalleryKeys.FETCH_IMAGES,
        abortOnUnmount: true,
        fn: db => db.files.listImageByTrip(this.currentTripId!, TripImagePlacement.ROUTE),
        onSuccess: (result) => {
          this.tripImages = result
        },
        onError: (error) => {
          console.error(`Ошибка при загрузке изображений для путешествия ${this.currentTripId}:`, error)
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
        fn: db => db.files.uploadFile(file, this.currentTripId!, TripImagePlacement.ROUTE),
        onSuccess: (result) => {
          this.tripImages.push(result)
        },
        onError: (error) => {
          console.error(`Ошибка при загрузке изображения для путешествия ${this.currentTripId}:`, error)
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
    },
  },
})
