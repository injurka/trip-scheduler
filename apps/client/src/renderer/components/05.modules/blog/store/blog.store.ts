import type { BlogListItems } from '~/shared/types/models/blog'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatus } from '~/plugins/request'

export enum EBlogKeys {
  FETCH_LIST = 'blog:fetch-list',
  FETCH_DETAIL = 'blog:fetch-detail',
}

interface BlogState {
  list: BlogListItems[]
  currentPost: any | null
  nextCursor?: string
}

export const useBlogStore = defineStore('blog', {
  state: (): BlogState => ({
    list: [],
    currentPost: null,
    nextCursor: undefined,
  }),

  getters: {
    isLoadingList: () => useRequestStatus(EBlogKeys.FETCH_LIST).value,
    isLoadingDetail: () => useRequestStatus(EBlogKeys.FETCH_DETAIL).value,
  },

  actions: {
    async fetchList() {
      if (this.list.length > 0)
        return

      await useRequest({
        key: EBlogKeys.FETCH_LIST,
        fn: api => api.blog.list(12),
        onSuccess: (data) => {
          this.list = data.items
          this.nextCursor = data.nextCursor
        },
      })
    },

    async fetchBySlug(slug: string) {
      this.currentPost = null
      await useRequest({
        key: EBlogKeys.FETCH_DETAIL,
        fn: api => api.blog.getBySlug(slug),
        onSuccess: (data) => {
          this.currentPost = data
        },
      })
    },
  },
})
