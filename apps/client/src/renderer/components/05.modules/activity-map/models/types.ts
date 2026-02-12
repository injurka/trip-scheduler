import type { CalendarDate } from '@internationalized/date'

export interface DateRange { start: CalendarDate | null, end: CalendarDate | null }

export interface GeoPoint {
  lat: number
  lon: number
}

export interface ScreenPosition {
  leftTop: GeoPoint
  center: GeoPoint
  rightBottom: GeoPoint
}

export interface MapBounds {
  screen: ScreenPosition
  zoomlevel: number
}

export interface GroupedMark {
  center: {
    type: 'Point'
    coordinates: [number, number]
  }
  count: number
}

export interface GetMarksParams extends MapBounds {
  startAt: string
  endAt: string
}
