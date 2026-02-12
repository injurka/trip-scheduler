import type { ListPostsFilters, PostDetail, PostElement, PostMedia, TimelineBlock, TimelineStage } from '~/shared/types/models/post'
import { defineStore } from 'pinia'
import { useRequest, useRequestStatus } from '~/plugins/request'

export enum EPostRequestKeys {
  LIST = 'post:list',
  GET_BY_ID = 'post:get-by-id',
  DELETE = 'post:delete',
  TOGGLE_SAVE = 'post:toggle-save',
  TOGGLE_LIKE = 'post:toggle-like',
}

/**
 * Преобразует `elements` из ответа API в `stages` для использования в UI.
 */
function transformElementsToStages(elements: PostElement[], allMedia: PostMedia[]): TimelineStage[] {
  return elements.map((element): TimelineStage => {
    const blocks: TimelineBlock[] = element.content.map((contentBlock): TimelineBlock => {
      switch (contentBlock.type) {
        case 'markdown':
          return { id: contentBlock.id, type: 'text', content: contentBlock.text }
        case 'gallery':
          return {
            id: contentBlock.id,
            type: 'gallery',
            images: allMedia.filter(media => contentBlock.imageIds.includes(media.id)),
            comment: '',
          }
        case 'location':
          return {
            id: contentBlock.id,
            type: 'location',
            coords: { lat: contentBlock.location.lat, lng: contentBlock.location.lng },
            name: contentBlock.location.label || '',
            address: contentBlock.location.address || '',
          }
        case 'route':
          return {
            id: contentBlock.id,
            type: 'route',
            from: 'Начало',
            to: 'Конец',
            distance: '',
            duration: '',
            transport: 'walk',
          }
        default:
          return { id: (contentBlock as any).id, type: 'text', content: '[Неподдерживаемый тип блока]' }
      }
    })

    return {
      id: element.id,
      title: element.title,
      order: element.order,
      blocks,
    }
  })
}

export const usePostStore = defineStore('post-main', {
  state: () => ({
    posts: [] as PostDetail[],
    nextCursor: undefined as string | undefined,
    filters: {
      search: '',
      tab: 'explore' as 'explore' | 'saved',
    },
  }),

  getters: {
    isLoading: () => useRequestStatus([EPostRequestKeys.LIST]).value,
    getPostById: state => (id: string) => state.posts.find(p => p.id === id),
  },

  actions: {
    async fetchPosts(reload = false) {
      if (reload) {
        this.nextCursor = undefined
        this.posts = []
      }

      const filters: ListPostsFilters = {
        limit: 10,
        cursor: this.nextCursor,
        query: this.filters.search || undefined,
        onlySaved: this.filters.tab === 'saved',
      }

      await useRequest<{ items: PostDetail[], nextCursor?: string }>({
        key: EPostRequestKeys.LIST,
        fn: db => db.posts.list(filters),
        onSuccess: (data) => {
          if (!data)
            return
          if (reload)
            this.posts = data.items
          else
            this.posts.push(...data.items)

          this.nextCursor = data.nextCursor
        },
      })
    },

    async fetchPostById(id: string): Promise<PostDetail | undefined> {
      // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
      // Убрана всякая проверка. Мы всегда запрашиваем свежие данные.
      let post: PostDetail | undefined
      await useRequest<PostDetail>({
        key: EPostRequestKeys.GET_BY_ID,
        fn: db => db.posts.getById({ id }),
        onSuccess: (data) => {
          if (data) {
            // Трансформируем данные в удобный для UI вид
            data.stages = transformElementsToStages(data.elements, data.media)

            // Обновляем или добавляем пост в локальное хранилище
            const existingIndex = this.posts.findIndex(p => p.id === id)
            if (existingIndex !== -1) {
              this.posts.splice(existingIndex, 1, data)
            }
            else {
              this.posts.unshift(data)
            }
            post = data
          }
        },
      })
      return post
    },

    async deletePost(id: string) {
      await useRequest({
        key: EPostRequestKeys.DELETE,
        fn: db => db.posts.delete({ id }),
        onSuccess: () => {
          this.posts = this.posts.filter(p => p.id !== id)
        },
      })
    },

    async toggleSave(id: string) {
      const post = this.posts.find(p => p.id === id)
      if (post)
        post.stats.isSaved = !post.stats.isSaved

      await useRequest<{ isSaved: boolean }>({
        key: EPostRequestKeys.TOGGLE_SAVE,
        fn: db => db.posts.toggleSave({ postId: id }),
        onSuccess: (res) => {
          if (post && res)
            post.stats.isSaved = res.isSaved
        },
        onError: ({ error }) => {
          if (post)
            post.stats.isSaved = !post.stats.isSaved
          useToast().error(error.customMessage || 'Не удалось сохранить пост.')
        },
      })
    },

    async toggleLike(id: string) {
      const post = this.posts.find(p => p.id === id)
      if (!post)
        return

      post.stats.isLiked = !post.stats.isLiked
      post.stats.likes += post.stats.isLiked ? 1 : -1

      await useRequest<{ isLiked: boolean }>({
        key: EPostRequestKeys.TOGGLE_LIKE,
        fn: db => db.posts.toggleLike({ postId: id }),
        onSuccess: (res) => {
          if (post && res)
            post.stats.isLiked = res.isLiked
        },
        onError: ({ error }) => {
          if (post) {
            post.stats.isLiked = !post.stats.isLiked
            post.stats.likes += post.stats.isLiked ? 1 : -1
          }
          useToast().error(error.customMessage || 'Не удалось поставить лайк.')
        },
      })
    },

    setSearch(query: string) {
      this.filters.search = query
      this.fetchPosts(true)
    },

    setTab(tab: 'explore' | 'saved') {
      this.filters.tab = tab
      this.fetchPosts(true)
    },
  },
})
