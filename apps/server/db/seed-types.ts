import type { PgTable } from 'drizzle-orm/pg-core'
import type * as tables from './schema'

export type Serialized<T> = T extends Date ? string | Date : T extends object ? { [Key in keyof T]: Serialized<T[Key]> } : T
export type DumpRow<Table extends PgTable> = Serialized<Table['$inferSelect']>

export type DumpDay = DumpRow<typeof tables.days> & { activities?: DumpRow<typeof tables.activities>[] }
export type DumpTrip = DumpRow<typeof tables.trips> & {
  days?: DumpDay[]
  images?: DumpRow<typeof tables.tripImages>[]
  memories?: DumpRow<typeof tables.memories>[]
  sections?: DumpRow<typeof tables.tripSections>[]
  participants?: DumpRow<typeof tables.tripParticipants>[]
  user?: unknown
  cityLinks?: unknown
  cities?: string[]
  weatherData?: unknown
}
export type DumpPost = DumpRow<typeof tables.posts> & {
  elements?: DumpRow<typeof tables.postElements>[]
  media?: DumpRow<typeof tables.postMedia>[]
  savedBy?: DumpRow<typeof tables.savedPosts>[]
}
export type DumpMetro = DumpRow<typeof tables.metroSystems> & {
  lines: Array<DumpRow<typeof tables.metroLines> & {
    lineStations: Array<DumpRow<typeof tables.metroLineStations> & { station: DumpRow<typeof tables.metroStations> }>
  }>
}
export interface GeoCatalogDump {
  dumpFormatVersion: number
  catalogMode: 'referenced-places'
  catalogVersions?: DumpRow<typeof tables.geoCatalogVersions>[]
  catalogCountries?: DumpRow<typeof tables.geoCatalogCountries>[]
  places?: DumpRow<typeof tables.geoPlaces>[]
  placeNames?: DumpRow<typeof tables.geoPlaceNames>[]
  tripPlaces?: Array<DumpRow<typeof tables.tripGeoPlaces> & { legacyLabel?: string, status?: string }>
  weatherCache?: DumpRow<typeof tables.geoWeatherCache>[]
  resolutionAudit?: DumpRow<typeof tables.geoResolutionAudit>[]
}
