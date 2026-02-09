interface ActivitySectionBase {
  id: string
  isAttached?: boolean
  title?: string
  icon?: string
  color?: string
}

export interface DayMetaInfo {
  id: string
  title: string
  subtitle?: string
  icon?: string
  color?: string
  content?: string
}

interface ActivitySectionText extends ActivitySectionBase {
  type: 'description'
  text: string
}

interface ActivitySectionGallery extends ActivitySectionBase {
  type: 'gallery'
  imageUrls: string[]
}

interface ActivitySectionGeolocation extends ActivitySectionBase {
  type: 'geolocation'
  points: any[]
  routes: any[]
  drawnRoutes: any[]
}

interface MetroRide {
  id: string
  startStationId: string | null
  startStation: string
  endStationId: string | null
  endStation: string
  lineId: string | null
  lineName: string
  lineNumber: string | null
  lineColor: string
  direction: string
  stops: number
}

interface ActivitySectionMetro extends ActivitySectionBase {
  type: 'metro'
  mode: 'free' | 'city'
  systemId: string | null
  rides: MetroRide[]
}

export type ActivitySection = ActivitySectionText | ActivitySectionGallery | ActivitySectionGeolocation | ActivitySectionMetro

export type PostElementBlock
  = | PostContentBlockText
    | PostContentBlockGallery
    | PostContentBlockLocation
    | PostContentBlockRoute

type PostContentBlockType = 'markdown' | 'image' | 'gallery' | 'location' | 'route'

interface PostContentBlockBase {
  id: string
  type: PostContentBlockType
}
interface PostContentBlockText extends PostContentBlockBase {
  type: 'markdown'
  text: string
}
interface PostContentBlockImage extends PostContentBlockBase {
  type: 'image'
  imageId: string
  caption?: string
  viewMode?: 'default' | 'full-width'
}
interface PostContentBlockGallery extends PostContentBlockBase {
  type: 'gallery'
  imageIds: string[]
  displayType: 'grid' | 'carousel'
}
interface MapPoint {
  lat: number
  lng: number
  label?: string
  address?: string
  color?: string
}
interface MapRoute {
  points: MapPoint[]
  color?: string
  title?: string
}
interface PostContentBlockLocation extends PostContentBlockBase {
  type: 'location'
  location: MapPoint
}
interface PostContentBlockRoute extends PostContentBlockBase {
  type: 'route'
  route: MapRoute
}
export type PostElementContent
  = | PostContentBlockText
    | PostContentBlockImage
    | PostContentBlockGallery
    | PostContentBlockLocation
    | PostContentBlockRoute

export interface PostStatsDetail {
  views: number
  budget: string
  duration: string
}
