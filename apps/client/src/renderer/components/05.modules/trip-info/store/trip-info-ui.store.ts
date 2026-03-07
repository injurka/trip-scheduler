import type { RemovableRef } from '@vueuse/core'
import type { ActiveView, InteractionMode } from '../models/types'
import { useStorage } from '@vueuse/core'

export interface ITripInfoUiState {
  isDaysPanelOpen: boolean
  isDaysPanelPinned: boolean
  isAddSectionDialogOpen: boolean
  isPossibleActivitiesDrawerOpen: boolean
  isParallelPlanView: boolean
  activeView: RemovableRef<ActiveView>
  interactionMode: RemovableRef<InteractionMode>
  collapsedActivities: Set<string>
  collapsedMemoryGroups: Set<string>
}

export const useTripInfoUiStore = defineStore('tripInfoUi', {
  state: (): ITripInfoUiState => ({
    isDaysPanelOpen: false,
    isDaysPanelPinned: false,
    isAddSectionDialogOpen: false,
    isPossibleActivitiesDrawerOpen: false,
    isParallelPlanView: false,
    activeView: useStorage<ActiveView>('trip-active-view', 'plan'),
    interactionMode: useStorage<InteractionMode>('tripinfo-interaction-mode', 'view'),
    collapsedActivities: new Set<string>(),
    collapsedMemoryGroups: new Set<string>(),
  }),

  getters: {
    isViewMode: state => state.interactionMode === 'view',
    areAllActivitiesCollapsed: state => (allIds: string[]) => {
      if (allIds.length === 0)
        return false
      return state.collapsedActivities.size === allIds.length
    },
    areAllMemoryGroupsCollapsed: state => (allGroupKeys: string[]) => {
      if (allGroupKeys.length > 0)
        return state.collapsedMemoryGroups.size === allGroupKeys.length
      return false
    },
  },

  actions: {
    toggleParallelPlanView() {
      this.isParallelPlanView = !this.isParallelPlanView
    },
    openPossibleActivitiesDrawer() {
      this.isPossibleActivitiesDrawerOpen = true
    },
    closePossibleActivitiesDrawer() {
      this.isPossibleActivitiesDrawerOpen = false
    },
    openAddSectionDialog() {
      this.isAddSectionDialogOpen = true
    },
    closeAddSectionDialog() {
      this.isAddSectionDialogOpen = false
    },
    openDaysPanel() {
      this.isDaysPanelOpen = true
    },
    closeDaysPanel() {
      this.isDaysPanelOpen = false
    },
    toggleDaysPanelPinned() {
      this.isDaysPanelPinned = !this.isDaysPanelPinned
    },
    setInteractionMode(mode: 'view' | 'edit') {
      this.interactionMode = mode
    },

    setActiveView(view: ActiveView) {
      this.activeView = view
      if (view !== 'plan') {
        this.isParallelPlanView = false
      }
    },

    toggleActivityCollapsed(id: string) {
      if (this.collapsedActivities.has(id))
        this.collapsedActivities.delete(id)
      else
        this.collapsedActivities.add(id)
    },

    toggleAllActivities(allIds: string[]) {
      const allCollapsed = allIds.length > 0 && this.collapsedActivities.size === allIds.length
      if (allCollapsed)
        this.collapsedActivities.clear()
      else
        this.collapsedActivities = new Set(allIds)
    },

    toggleMemoryGroupCollapsed(key: string) {
      if (this.collapsedMemoryGroups.has(key))
        this.collapsedMemoryGroups.delete(key)
      else
        this.collapsedMemoryGroups.add(key)
    },

    toggleAllMemoryGroups(allGroupKeys: string[]) {
      const allCollapsed = allGroupKeys.length > 0 && this.collapsedMemoryGroups.size === allGroupKeys.length
      if (allCollapsed)
        this.collapsedMemoryGroups.clear()
      else
        this.collapsedMemoryGroups = new Set(allGroupKeys)
    },

    clearCollapsedState() {
      this.collapsedActivities.clear()
      this.collapsedMemoryGroups.clear()
    },

    reset() {
      this.isDaysPanelOpen = false
      this.isDaysPanelPinned = false
      this.isParallelPlanView = false
      this.activeView = 'plan'
      this.interactionMode = 'view'
      this.clearCollapsedState()
    },
  },
})
