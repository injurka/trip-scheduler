export interface PostStatsDetail {
  views: number
  duration: number
}

export interface MapPoint {
  lat: number
  lng: number
  label?: string
  address?: string
  color?: string
}

export interface MapRoute {
  points: MapPoint[]
  color?: string
  title?: string
}

export type TimelineBlockType = 'text' | 'gallery' | 'location' | 'route'

export interface TimelineBlockBase {
  id: string
  type: TimelineBlockType
}

export interface TextBlock extends TimelineBlockBase {
  type: 'text'
  content: string
}

export interface GalleryBlock extends TimelineBlockBase {
  type: 'gallery'
  images: PostMedia[]
  comment?: string
  displayType?: 'grid' | 'panorama' | 'masonry' | 'slider'
}

export interface LocationBlock extends TimelineBlockBase {
  type: 'location'
  coords: { lat: number, lng: number }
  name?: string
  address?: string
}

export interface RouteBlock extends TimelineBlockBase {
  type: 'route'
  from: string
  to: string
  distance?: string
  duration?: string
  transport: 'walk' | 'transit' | 'car'
}

export type TimelineBlock = TextBlock | GalleryBlock | LocationBlock | RouteBlock

export interface TimelineStage {
  id: string
  title: string
  day?: number
  time?: string | null
  order: number
  blocks: TimelineBlock[]
  icon?: string
}

export interface PostMark {
  id: string
  x: number
  y: number
  label: string
}

export interface PostMedia {
  id: string
  type: 'image' | 'video'
  url: string
  marks?: PostMark[]
  originalName?: string
  width?: number
  height?: number
  metadata?: any
}

export interface PostElement {
  id: string
  title?: string
  day: number
  time?: string | null
  order: number
  content: any[]
}

export interface PostDetail {
  id: string
  title: string
  insight?: string
  description?: string
  country?: string
  city?: string
  latitude: number
  longitude: number
  startDate?: string | null
  tags: string[]
  status: 'draft' | 'completed' | 'planned'
  statsDetail: PostStatsDetail
  media: PostMedia[]
  elements: PostElement[]
  stages?: TimelineStage[]
  user: {
    id: string
    name: string | null
    avatarUrl?: string | null
  }
  stats: {
    likes: number
    saves: number
    isLiked: boolean
    isSaved: boolean
  }
  createdAt: string
}

export interface ListPostsFilters {
  limit?: number
  cursor?: string
  userId?: string
  tag?: string
  country?: string
  query?: string
  onlySaved?: boolean
}

export interface CreatePostInput {
  title: string
  insight?: string
  description?: string
  country?: string
  startDate?: string | null
  tags: string[]
  status: 'draft' | 'completed' | 'planned'
  elements?: any[]
  mediaIds?: string[]
  latitude?: number
  longitude?: number
  statsDetail?: Partial<PostStatsDetail>
}

export interface UpdatePostInput extends Partial<CreatePostInput> { }
