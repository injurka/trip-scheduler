export type PostCategory = 'food' | 'nature' | 'culture' | 'sport' | 'other'

export interface PostMark {
  id: string
  x: number // процент по X (0-100)
  y: number // процент по Y (0-100)
  label: string
}

export interface PostMedia {
  id: string
  url: string
  type: 'image' | 'video'
  marks?: PostMark[]
}

export interface PostLocation {
  city: string
  country: string
  address: string
  lat: number
  lng: number
}

export interface Post {
  id: string
  author: {
    id: string
    name: string
    avatarUrl: string
  }
  createdAt: string // ISO date

  // Гео
  location: PostLocation

  // Контент
  title: string
  ratingEmoji: string // 😍, 🤯, etc.
  category: PostCategory

  // Медиа
  media: PostMedia[]

  // Теги
  tags: {
    category: string[] // #Еда, #Прогулка
    context: string[] // #Дешево, #Тишина
  }

  // Инсайт (короткое описание)
  insight: string
  description?: string // Полное описание (скрытое)

  // Статистика
  stats: {
    likes: number
    saves: number
    isLiked: boolean
    isSaved: boolean
  }
}

export type TimelineBlockType = 'text' | 'gallery' | 'location' | 'route'

export interface TimelineBlockBase {
  id: string
  type: TimelineBlockType
}

export interface TextBlock extends TimelineBlockBase {
  type: 'text'
  content: string // Markdown support
}

export interface GalleryBlock extends TimelineBlockBase {
  type: 'gallery'
  images: PostMedia[]
  comment?: string
}

export interface LocationBlock extends TimelineBlockBase {
  type: 'location'
  name: string
  address: string
  coords: { lat: number, lng: number }
}

export interface RouteBlock extends TimelineBlockBase {
  type: 'route'
  from: string
  to: string
  distance: string // "1.5 км"
  duration: string // "20 мин"
  transport: 'walk' | 'car' | 'transit'
}

export type TimelineBlock = TextBlock | GalleryBlock | LocationBlock | RouteBlock

export interface TimelineStage {
  id: string
  title: string
  time?: string
  icon?: string // 'mdi:food', 'mdi:walk'
  blocks: TimelineBlock[]
}

// Расширяем Post для детального просмотра
export interface PostDetail extends Post {
  statsDetail: {
    views: number
    budget: string
    duration: string
  }
  stages: TimelineStage[]
}
