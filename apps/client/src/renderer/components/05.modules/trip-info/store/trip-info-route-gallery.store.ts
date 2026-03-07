import type { TripImage } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatus, useRequestStatusByPrefix } from '~/plugins/request'
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
    isUploadingImage: () => useRequestStatusByPrefix(ETripGalleryKeys.UPLOAD_IMAGE).value,
  },

  actions: {
    setTripId(tripId: string) {
      if (this.currentTripId !== tripId) {
        this.currentTripId = tripId
        this.loadedTripId = null
        this.tripImages = []
      }
    },

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

    async uploadImage(file: File): Promise<TripImage | null> {
      if (!this.currentTripId) {
        console.error('Trip ID не установлен для загрузки изображения.')
        return null
      }

      const uniqueRequestKey = `${ETripGalleryKeys.UPLOAD_IMAGE}:${crypto.randomUUID()}`

      const newImage = await useRequest<TripImage>({
        key: uniqueRequestKey,
        cancelPrevious: false, 
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

    reset() {
      this.tripImages = []
      this.currentTripId = null
      this.loadedTripId = null
    },
  },
})
