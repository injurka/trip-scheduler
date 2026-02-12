export type TimelineBlockType = 'text' | 'gallery' | 'location' | 'route'

export interface PostMark {
  id: string
  x: number
  y: number
  label: string
}

export interface PostMedia {
  id: string
  url: string
  type: 'image' | 'video'
  marks?: PostMark[]
}

export interface TextBlock {
  id: string
  type: 'text'
  content: string
}

export interface GalleryBlock {
  id: string
  type: 'gallery'
  images: PostMedia[]
  comment?: string
}

export interface LocationBlock {
  id: string
  type: 'location'
  coords: { lat: number, lng: number }
  name: string
  address: string
}

export interface RouteBlock {
  id: string
  type: 'route'
  from: string
  to: string
  distance: string
  duration: string
  transport: 'walk' | 'car' | 'transit'
}

export type TimelineBlock = TextBlock | GalleryBlock | LocationBlock | RouteBlock

export interface TimelineStage {
  id: string
  title: string
  time?: string
  icon?: string
  order: number
  blocks: TimelineBlock[]
}

interface PostContentBlockText {
  id: string
  type: 'markdown'
  text: string
}
interface PostContentBlockGallery {
  id: string
  type: 'gallery'
  imageIds: string[]
  displayType: 'grid' | 'carousel'
}
interface MapPoint {
  lat: number
  lng: number
  label?: string
  address?: string
}
interface PostContentBlockLocation {
  id: string
  type: 'location'
  location: MapPoint
}
interface PostContentBlockRoute {
  id: string
  type: 'route'
  route: any
}

type PostElementContent = PostContentBlockText | PostContentBlockGallery | PostContentBlockLocation | PostContentBlockRoute

export interface PostElement {
  id: string
  postId: string
  order: number
  title: string
  content: PostElementContent[]
  createdAt: string
  updatedAt: string
}

export interface PostDetail {
  id: string
  createdAt: string
  country: string
  city?: string
  latitude: number
  longitude: number
  title: string
  insight: string
  description: string
  status: 'draft' | 'completed' | 'planned'
  tags: string[]
  statsDetail: {
    views: number
    budget: string
    duration: string
  }
  stats: {
    likes: number
    saves: number
    isLiked: boolean
    isSaved: boolean
  }

  media: PostMedia[]
  elements: PostElement[]
  stages?: TimelineStage[]

  user: {
    id: string
    name: string
    avatarUrl: string
  }
}

export type Post = Omit<PostDetail, 'stages' | 'elements' | 'description'>

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
  latitude?: number
  longitude?: number
  tags?: string[]
  status?: 'draft' | 'completed' | 'planned'
  statsDetail?: {
    budget?: string
    duration?: string
  }
  elements?: {
    title?: string
    content: any[]
  }[]
  mediaIds?: string[]
}

export interface UpdatePostInput extends Partial<CreatePostInput> { }
