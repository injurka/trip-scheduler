import { v5 as uuidv5 } from 'uuid'

export const GEO_NAMES_URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

/** Stable app UUID for a GeoNames source ID; city records themselves are stored in PostgreSQL. */
export function geoNamesPlaceId(sourceId: string): string {
  if (!/^\d+$/.test(sourceId)) {
    throw new TypeError('GeoNames source ID must contain decimal digits only')
  }

  return uuidv5(`https://www.geonames.org/${sourceId}`, GEO_NAMES_URL_NAMESPACE)
}
