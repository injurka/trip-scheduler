import type { CalendarDate } from '@internationalized/date'
import type { GetMarksParams, MapBounds } from '../models/types'
import type { CreateMarkInput, Mark } from '~/shared/types/models/mark'
import { getLocalTimeZone, today } from '@internationalized/date'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatus } from '~/plugins/request'

export enum EActivityMapKeys {
  FETCH_MARKS = 'activity-map:fetch-marks',
  CREATE_MARK = 'activity-map:create-mark',
}

interface ActivityMapState {
  marks: Mark[]
  dateRange: { start: CalendarDate | null, end: CalendarDate | null }
  currentMapParams: MapBounds | null
}

export const useActivityMapStore = defineStore('activityMap', {
  state: (): ActivityMapState => ({
    marks: [],
    dateRange: {
      start: today(getLocalTimeZone()),
      end: today(getLocalTimeZone()),
    },
    currentMapParams: null,
  }),

  getters: {
    isLoading: () => useRequestStatus(EActivityMapKeys.FETCH_MARKS).value,
    isCreating: () => useRequestStatus(EActivityMapKeys.CREATE_MARK).value,

    apiDateParams(state): { startAt?: string, endAt?: string } {
      if (!state.dateRange.start) {
        return {}
      }

      let startAt = new Date().toISOString()
      let endAt = new Date().toISOString()

      const startDate = state.dateRange.start.toDate(getLocalTimeZone())
      startDate.setHours(0, 0, 0, 0)
      startAt = startDate.toISOString()

      const endDate = state.dateRange.end
        ? state.dateRange.end.toDate(getLocalTimeZone())
        : state.dateRange.start.toDate(getLocalTimeZone())

      endDate.setHours(23, 59, 59, 999)
      endAt = endDate.toISOString()

      return { startAt, endAt }
    },
  },

  actions: {
    async fetchMarks(mapBounds?: MapBounds) {
      if (mapBounds) {
        this.currentMapParams = mapBounds
      }

      const params: GetMarksParams = {
        ...this.apiDateParams,
      }

      if (this.currentMapParams) {
        params.screen = this.currentMapParams.screen
        params.zoomlevel = Math.round(this.currentMapParams.zoomlevel)
      }

      await useRequest({
        key: EActivityMapKeys.FETCH_MARKS,
        cancelPrevious: true,
        fn: db => db.marks.getMarks(params),
        onSuccess: (data) => {
          this.marks = data
        },
        onError: () => {
          this.marks = []
        },
      })
    },

    async createMark(input: CreateMarkInput) {
      await useRequest({
        key: EActivityMapKeys.CREATE_MARK,
        fn: db => db.marks.createMark(input),
        onSuccess: () => {
          this.fetchMarks()
        },
        onError: ({ error }) => {
          throw error
        },
      })
    },

    resetFilters() {
      this.dateRange = { start: null, end: null }
      this.fetchMarks()
    },
  },
})
