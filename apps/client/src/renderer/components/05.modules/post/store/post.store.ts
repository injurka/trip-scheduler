import type { PostCategory, PostDetail } from '../models/types'
import { defineStore } from 'pinia'

// Моковые данные для начального заполнения
const MOCK_POSTS: PostDetail[] = [
  {
    id: '1',
    author: { id: 'u1', name: 'Алексей Путешественник', avatarUrl: '' },
    createdAt: new Date().toISOString(),
    location: { country: 'Китай', city: 'Шанхай', address: 'The Bund', lat: 31.2304, lng: 121.4737 },
    title: 'Прогулка по Набережной Вайтан',
    ratingEmoji: '😍',
    category: 'culture',
    media: [{ id: 'm1', type: 'image', url: '/avatars/ghoul.gif' }],
    tags: { category: ['Прогулка', 'Архитектура'], context: ['Бесплатно', 'Вечер'] },
    insight: 'Лучшее время — 18:30, когда включают подсветку.',
    stats: { likes: 124, saves: 45, isLiked: true, isSaved: false },
    statsDetail: { views: 1205, budget: 'Бесплатно', duration: '2 часа' },
    stages: [
      {
        id: 's1',
        title: 'Старт у монумента',
        time: '18:00',
        blocks: [
          { id: 'b1', type: 'text', content: 'Встречаемся у памятника Народным Героям.' },
          { id: 'b2', type: 'location', name: 'Monument', address: 'The Bund', coords: { lat: 31.2, lng: 121.4 } },
        ],
      },
    ],
  },
  {
    id: '2',
    author: { id: 'u2', name: 'Мария Еда', avatarUrl: '' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    location: { country: 'Италия', city: 'Рим', address: 'Trastevere', lat: 41.88, lng: 12.47 },
    title: 'Скрытый дворик для завтрака',
    ratingEmoji: '😋',
    category: 'food',
    media: [{ id: 'm3', type: 'image', url: '/avatars/ghoul.gif' }],
    tags: { category: ['Еда', 'Завтрак'], context: ['Свидание', 'Тишина'] },
    insight: 'Обязательно попробуйте круассан с миндалем!',
    stats: { likes: 89, saves: 120, isLiked: false, isSaved: true },
    statsDetail: { views: 800, budget: '$$', duration: '1 час' },
    stages: [],
  },
]

export const usePostStore = defineStore('post-main', {
  state: () => ({
    posts: [...MOCK_POSTS] as PostDetail[],
    filters: {
      search: '',
      category: null as PostCategory | null,
      tab: 'explore' as 'explore' | 'saved',
    },
  }),

  getters: {
    getPostById: state => (id: string) => state.posts.find(p => p.id === id),

    // Умный геттер фильтрации
    filteredPosts: (state) => {
      let result = state.posts

      // 1. Таб (Все или Сохраненные)
      if (state.filters.tab === 'saved') {
        result = result.filter(p => p.stats.isSaved)
      }

      // 2. Категория
      if (state.filters.category) {
        result = result.filter(p => p.category === state.filters.category)
      }

      // 3. Поиск (по заголовку, городу или тегам)
      const query = state.filters.search.toLowerCase().trim()
      if (query) {
        result = result.filter(p =>
          p.title.toLowerCase().includes(query)
          || p.location.city.toLowerCase().includes(query)
          || p.location.country.toLowerCase().includes(query)
          || p.tags.category.some(t => t.toLowerCase().includes(query)),
        )
      }

      return result
    },
  },

  actions: {
    createPost(post: PostDetail) {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const newPost = {
            ...post,
            createdAt: new Date().toISOString(),
            author: { id: 'me', name: 'Я', avatarUrl: '' },
            stats: { likes: 0, saves: 0, isLiked: false, isSaved: false },
            statsDetail: { views: 0, budget: 'Не указан', duration: '1 день' },
          }
          this.posts.unshift(newPost)
          resolve()
        }, 500)
      })
    },

    toggleLike(id: string) {
      const post = this.posts.find(p => p.id === id)
      if (post) {
        post.stats.isLiked = !post.stats.isLiked
        post.stats.likes += post.stats.isLiked ? 1 : -1
      }
    },

    toggleSave(id: string) {
      const post = this.posts.find(p => p.id === id)
      if (post) {
        post.stats.isSaved = !post.stats.isSaved
      }
    },

    // Методы управления фильтрами
    setSearch(query: string) {
      this.filters.search = query
    },

    setCategory(category: PostCategory | null) {
      // Если кликнули по уже активной категории — сбрасываем
      if (this.filters.category === category) {
        this.filters.category = null
      }
      else {
        this.filters.category = category
      }
    },

    setTab(tab: 'explore' | 'saved') {
      this.filters.tab = tab
    },
  },
})
