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

    apiDateParams(state): { startAt: string, endAt: string } {
      const now = new Date()
      let startAt = now.toISOString()
      let endAt = now.toISOString()

      if (state.dateRange.start) {
        const startDate = state.dateRange.start.toDate(getLocalTimeZone())
        startDate.setHours(0, 0, 0, 0)
        startAt = startDate.toISOString()

        const endDate = state.dateRange.end
          ? state.dateRange.end.toDate(getLocalTimeZone())
          : state.dateRange.start.toDate(getLocalTimeZone())

        endDate.setHours(23, 59, 59, 999)
        endAt = endDate.toISOString()
      }

      return { startAt, endAt }
    },
  },

  actions: {
    async fetchMarks(mapBounds?: MapBounds) {
      if (mapBounds) {
        this.currentMapParams = mapBounds
      }

      if (!this.currentMapParams)
        return

      const params: GetMarksParams = {
        screen: this.currentMapParams.screen,
        zoomlevel: Math.round(this.currentMapParams.zoomlevel),
        ...this.apiDateParams,
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
      this.dateRange = { start: today(getLocalTimeZone()), end: today(getLocalTimeZone()) }
      this.fetchMarks()
    },
  },
})
