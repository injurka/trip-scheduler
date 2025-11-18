import type { Place, PlaceTag } from '~/shared/types/models/place'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatus } from '~/plugins/request'

export enum EExploreKeys {
  FETCH_PLACES = 'explore:fetch-places',
  FETCH_TAGS = 'explore:fetch-tags',
}

interface IExploreState {
  places: Place[]
  tags: PlaceTag[]
  currentCity: string | null
  selectedTagIds: string[]
}

export const useExploreStore = defineStore('exploreHub', {
  state: (): IExploreState => ({
    places: [],
    tags: [],
    currentCity: null,
    selectedTagIds: [],
  }),

  getters: {
    isLoading: () => useRequestStatus([EExploreKeys.FETCH_PLACES, EExploreKeys.FETCH_TAGS]).value,

    filteredPlaces(state): Place[] {
      if (state.selectedTagIds.length === 0) {
        return state.places
      }
      return state.places.filter(place =>
        state.selectedTagIds.every(tagId => place.tags.some(pt => pt.id === tagId)),
      )
    },
  },

  actions: {
    async fetchPlacesByCity(city: string) {
      if (this.currentCity === city && this.places.length > 0)
        return

      this.currentCity = city
      this.places = []
      this.tags = []

      await useRequest({
        key: EExploreKeys.FETCH_PLACES,
        fn: db => db.places.getPlacesByCity(city),
        onSuccess: (data) => {
          this.places = data
        },
      })

      await useRequest({
        key: EExploreKeys.FETCH_TAGS,
        fn: db => db.places.getAvailableTags(city),
        onSuccess: (data) => {
          this.tags = data
        },
      })
    },

    toggleTagFilter(tagId: string) {
      const index = this.selectedTagIds.indexOf(tagId)
      if (index > -1) {
        this.selectedTagIds.splice(index, 1)
      }
      else {
        this.selectedTagIds.push(tagId)
      }
    },
  },
})
