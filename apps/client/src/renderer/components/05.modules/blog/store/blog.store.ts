import type { BlogListItems, CreateBlogPostInput, UpdateBlogPostInput } from '~/shared/types/models/blog'
import { useRequest, useRequestStatus } from '~/plugins/request'

export enum EBlogKeys {
  FETCH_LIST = 'blog:fetch-list',
  FETCH_DETAIL = 'blog:fetch-detail',
  CREATE = 'blog:create',
  UPDATE = 'blog:update',
  DELETE = 'blog:delete',
  UPLOAD_IMAGE = 'blog:upload-image',
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
    isSaving: () => useRequestStatus([EBlogKeys.CREATE, EBlogKeys.UPDATE]).value,
    isUploading: () => useRequestStatus(EBlogKeys.UPLOAD_IMAGE).value,
  },

  actions: {
    async fetchList(force = false) {
      if (!force && this.list.length > 0)
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

    async fetchById(id: string) {
      this.currentPost = null
      await useRequest({
        key: EBlogKeys.FETCH_DETAIL,
        fn: api => api.blog.getById(id),
        onSuccess: (data) => {
          this.currentPost = data
        },
      })
    },

    async createPost(data: CreateBlogPostInput) {
      return await useRequest({
        key: EBlogKeys.CREATE,
        fn: api => api.blog.create(data),
        onSuccess: (newPost) => {
          this.list.unshift(newPost)
        },
      })
    },

    async updatePost(data: UpdateBlogPostInput) {
      return await useRequest({
        key: EBlogKeys.UPDATE,
        fn: api => api.blog.update(data),
        onSuccess: (updatedPost) => {
          if (this.currentPost && this.currentPost.id === updatedPost.id) {
            this.currentPost = updatedPost
          }
          const index = this.list.findIndex(p => p.id === updatedPost.id)
          if (index !== -1) {
            this.list[index] = { ...this.list[index], ...updatedPost }
          }
        },
      })
    },

    async deletePost(id: string) {
      await useRequest({
        key: EBlogKeys.DELETE,
        fn: api => api.blog.delete(id),
        onSuccess: () => {
          this.list = this.list.filter(p => p.id !== id)
        },
      })
    },

    async uploadImage(file: File) {
      // TODO

      return file
    },
  },
})
