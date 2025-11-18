import type { ActivitySectionGeolocation } from '~/components/03.domain/trip-info/plan-geolocation-section/models/types'

export enum EActivityTag {
  TRANSPORT = 'transport',
  WALK = 'walk',
  FOOD = 'food',
  ATTRACTION = 'attraction',
  RELAX = 'relax',
}

export enum EActivitySectionType {
  DESCRIPTION = 'description',
  GALLERY = 'gallery',
  GEOLOCATION = 'geolocation',
  METRO = 'metro',
}

export interface ActivitySection {
  id: string
  type: EActivitySectionType
  isAttached?: boolean
  title?: string
  icon?: string
}

export interface ActivitySectionText extends ActivitySection {
  type: EActivitySectionType.DESCRIPTION
  text: string
}

export interface ActivitySectionGallery extends ActivitySection {
  type: EActivitySectionType.GALLERY
  imageUrls: string[]
}

export interface MetroRide {
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

export interface ActivitySectionMetro extends ActivitySection {
  type: EActivitySectionType.METRO
  mode: 'free' | 'city'
  systemId: string | null
  rides: MetroRide[]
}

export type ActivitySections = (ActivitySectionText | ActivitySectionGallery | ActivitySectionGeolocation | ActivitySectionMetro)[]

export interface Activity {
  id: string
  dayId: string
  title: string
  startTime: string
  endTime: string
  //
  sections?: ActivitySections
  tag?: EActivityTag
  rating?: number | null
  status: EActivityStatus
}

export enum EActivityStatus {
  NONE = 'none',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

export interface DayMetaInfo {
  id: string
  title: string
  subtitle?: string
  icon?: string
  color?: string
  content?: string
}
export interface Day {
  id: string
  tripId: string
  date: string
  title: string
  description: string
  activities: Activity[]
  meta?: DayMetaInfo[]
}
