import type { Community, CommunityPrivacy, ListCommunitiesInput } from '~/shared/types/models/community'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatusByPrefix } from '~/plugins/request'

export type CommunitiesHubTab = 'my' | 'public'

export interface ICommunitiesHubState {
  communities: Community[]
  activeTab: CommunitiesHubTab
  searchQuery: string
}

export const useCommunitiesHubStore = defineStore('communitiesHub', {
  state: (): ICommunitiesHubState => ({
    communities: [],
    activeTab: 'my',
    searchQuery: '',
  }),

  getters: {
    isLoading: state => useRequestStatusByPrefix(`communities:fetch:${state.activeTab}`).value,
  },

  actions: {
    async fetchCommunities(force = false) {
      if (!force && this.communities.length > 0)
        return

      const filters: ListCommunitiesInput = {
        tab: this.activeTab,
        search: this.searchQuery || undefined,
      }

      await useRequest<Community[]>({
        key: `communities:fetch:${this.activeTab}`,
        force,
        fn: db => db.community.list(filters),
        onSuccess: (data) => {
          this.communities = data
        },
        onError: () => {
          useToast().error('Не удалось загрузить список сообществ.')
        },
      })
    },

    async createCommunity(data: { name: string, description?: string, privacyType: CommunityPrivacy }) {
      await useRequest<Community>({
        key: 'communities:create',
        fn: db => db.community.create(data, ''),
        onSuccess: (newCommunity) => {
          this.communities.unshift(newCommunity)
          useToast().success(`Сообщество "${newCommunity.name}" создано.`)
        },
        onError: (error: any) => {
          useToast().error(error.message || 'Ошибка при создании сообщества.')
        },
      })
    },

    setActiveTab(tab: CommunitiesHubTab) {
      if (this.activeTab !== tab) {
        this.activeTab = tab
        this.communities = [] // Clear old data
        this.fetchCommunities(true)
      }
    },
  },
})
