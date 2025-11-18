import type { Comment, CommentParentType } from '~/shared/types/models/comment'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatusByPrefix } from '~/plugins/request'
import { useAuthStore } from '~/shared/store/auth.store'

export enum ETripCommentsKeys {
  FETCH = 'comments:fetch',
  FETCH_MORE = 'comments:fetch-more',
  CREATE = 'comments:create',
  UPDATE = 'comments:update',
  DELETE = 'comments:delete',
}

export interface CommentCollection {
  comments: Comment[]
  page: number
  hasMore: boolean
  total: number
}

export interface ITripCommentsState {
  comments: Map<string, CommentCollection>
}

export const useTripCommentsStore = defineStore('tripComments', {
  state: (): ITripCommentsState => ({
    comments: new Map(),
  }),

  getters: {
    isLoading: () => useRequestStatusByPrefix(ETripCommentsKeys.FETCH).value,
    isLoadingMore: () => useRequestStatusByPrefix(ETripCommentsKeys.FETCH_MORE).value,

    getCommentsByParentId: (state) => {
      return (parentId: string): Comment[] => state.comments.get(parentId)?.comments || []
    },
    getCommentCollectionByParentId: (state) => {
      return (parentId: string): CommentCollection | undefined => state.comments.get(parentId)
    },
  },

  actions: {
    async fetchComments(parentId: string) {
      if (!parentId)
        return

      const limit = 20

      await useRequest({
        key: `${ETripCommentsKeys.FETCH}:${parentId}`,
        force: true,
        fn: db => db.comments.list({ parentId, page: 1, limit }),
        onSuccess: (result) => {
          this.comments.set(parentId, {
            comments: result.data.slice().reverse(),
            page: 1,
            total: result.total,
            hasMore: result.data.length < result.total,
          })
        },
      })
    },

    async fetchMoreComments(parentId: string) {
      if (!parentId)
        return

      const collection = this.comments.get(parentId)
      if (!collection || !collection.hasMore || this.isLoadingMore)
        return

      const nextPage = collection.page + 1
      const limit = 20

      await useRequest({
        key: `${ETripCommentsKeys.FETCH_MORE}:${parentId}`,
        fn: db => db.comments.list({ parentId, page: nextPage, limit }),
        onSuccess: (result) => {
          const currentCollection = this.comments.get(parentId)!
          const newComments = result.data.slice().reverse()
          currentCollection.comments = [...newComments, ...currentCollection.comments]
          currentCollection.page = nextPage
          currentCollection.total = result.total
          currentCollection.hasMore = currentCollection.comments.length < result.total
        },
        onError: () => {
          useToast().error('Не удалось загрузить больше комментариев.')
        },
      })
    },

    async addComment(text: string, parentId: string, parentType: CommentParentType) {
      const authStore = useAuthStore()
      if (!authStore.user) {
        useToast().error('Вы должны быть авторизованы, чтобы оставлять комментарии.')
        return
      }

      const tempId = `temp-comment-${Date.now()}`
      const optimisticComment: Comment = {
        id: tempId,
        text,
        parentId,
        parentType,
        userId: authStore.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: authStore.user.id,
          name: authStore.user.name,
          avatarUrl: authStore.user.avatarUrl,
        },
      }

      const collection = this.comments.get(parentId)
      if (collection) {
        collection.comments.push(optimisticComment)
        collection.total++
      }
      else {
        this.comments.set(parentId, {
          comments: [optimisticComment],
          page: 1,
          hasMore: false,
          total: 1,
        })
      }

      await useRequest({
        key: `${ETripCommentsKeys.CREATE}:${tempId}`,
        fn: db => db.comments.create({ text, parentId, parentType }),
        onSuccess: (newComment) => {
          const currentCollection = this.comments.get(parentId)!
          const index = currentCollection.comments.findIndex((c: Comment) => c.id === tempId)
          if (index !== -1) {
            currentCollection.comments[index] = newComment as Comment
          }
        },
        onError: () => {
          const currentCollection = this.comments.get(parentId)!
          currentCollection.comments = currentCollection.comments.filter((c: Comment) => c.id !== tempId)
          currentCollection.total--
          useToast().error('Не удалось отправить комментарий.')
        },
      })
    },

    async deleteComment(commentId: string, parentId: string) {
      const collection = this.comments.get(parentId)
      if (!collection)
        return

      const commentsList = collection.comments
      const index = commentsList.findIndex((c: Comment) => c.id === commentId)
      if (index === -1)
        return

      const [removedComment] = commentsList.splice(index, 1)
      collection.total--

      await useRequest({
        key: `${ETripCommentsKeys.DELETE}:${commentId}`,
        fn: db => db.comments.delete({ commentId }),
        onError: () => {
          commentsList.splice(index, 0, removedComment)
          collection.total++
          useToast().error('Не удалось удалить комментарий.')
        },
      })
    },
  },
})
