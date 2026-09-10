export interface LocationCoords {
  lat: number
  lon: number
}

export interface FlightSegment {
  departureCity?: string
  arrivalCity?: string
  departureAirport?: string // IATA code
  arrivalAirport?: string // IATA code
  departureAirportLocation?: LocationCoords
  arrivalAirportLocation?: LocationCoords
  departureDateTime?: string // ISO 8601 format: YYYY-MM-DDTHH:mm:ss
  arrivalDateTime?: string // ISO 8601 format: YYYY-MM-DDTHH:mm:ss
  departureTimeZone?: string // Timezone offset, e.g., "+03:00"
  arrivalTimeZone?: string // Timezone offset, e.g., "+08:00"
  flightNumber?: string
  airline?: string
  airlineIataCode?: string
  aircraft?: string
  terminalDeparture?: string
  terminalArrival?: string
}

export interface FlightData {
  bookingReference?: string
  notes?: string
  segments: FlightSegment[]
  sourceUrl?: string
}

export interface HotelData {
  hotelName?: string
  address?: string
  location?: LocationCoords
  checkInDate?: string // YYYY-MM-DD
  checkOutDate?: string // YYYY-MM-DD
  roomType?: string
  guests?: string
  confirmationNumber?: string
  phone?: string
  email?: string
  website?: string
  notes?: string
  sourceUrl?: string
}

export interface TrainData {
  departureStation?: string
  arrivalStation?: string
  departureStationLocation?: LocationCoords
  arrivalStationLocation?: LocationCoords
  departureDateTime?: string // ISO 8601 format
  arrivalDateTime?: string // ISO 8601 format
  departureTimeZone?: string // Timezone offset, e.g., "+03:00"
  arrivalTimeZone?: string // Timezone offset, e.g., "+03:00"
  trainNumber?: string
  carriage?: string
  seat?: string
  departurePlatform?: string
  arrivalPlatform?: string
  bookingReference?: string
  notes?: string
  sourceUrl?: string
}

export interface AttractionData {
  attractionName?: string
  address?: string
  location?: LocationCoords
  dateTime?: string // ISO 8601 format
  ticketType?: string
  guests?: string
  bookingReference?: string
  notes?: string
  sourceUrl?: string
}

/**
 * Пометки («теги») для раздела «Авто»: раздел объединяет такси, трансфер,
 * аренду, личное авто, авто с водителем и автобус, поэтому каждая запись
 * должна нести визуально понятный признак.
 *
 * Значения должны быть синхронизированы с `CAR_KINDS` в клиенте
 * (booking-section/models/booking-kinds.ts).
 */
export type CarKind = 'taxi' | 'transfer' | 'chauffeur' | 'rental' | 'personal' | 'bus' | 'bike' | 'other'

/**
 * Пометки для раздела «Другое» (паром, катер, канатная дорога, электровелосипед
 * и прочие неочевидные способы перемещения).
 *
 * Значения должны быть синхронизированы с `OTHER_KINDS` в клиенте.
 */
export type OtherKind = 'ferry' | 'boat' | 'cablecar' | 'bike' | 'pedestrian' | 'luggage' | 'other'

export interface CarData {
  kind?: CarKind
  company?: string
  carModel?: string
  carType?: string
  pickupLocation?: string
  pickupCoords?: LocationCoords
  dropoffLocation?: string
  dropoffCoords?: LocationCoords
  pickupDateTime?: string // ISO 8601 format
  dropoffDateTime?: string // ISO 8601 format
  pickupTimeZone?: string
  dropoffTimeZone?: string
  confirmationNumber?: string
  phone?: string
  email?: string
  notes?: string
  sourceUrl?: string
}

/**
 * Раздел «Другое»: паромы, катера, канатные дороги, электровелосипеды,
 * пешие переходы и прочие перемещения, которые не являются ни «Авто»,
 * ни «Поездом». Точечные перемещения описываются парой start/end.
 */
export interface OtherData {
  kind?: OtherKind
  name?: string // Что это за перемещение
  startLocation?: string
  endLocation?: string
  startCoords?: LocationCoords
  endCoords?: LocationCoords
  startDateTime?: string // ISO 8601 format
  endDateTime?: string // ISO 8601 format
  startTimeZone?: string
  endTimeZone?: string
  bookingReference?: string
  notes?: string
  sourceUrl?: string
}

export interface BookingBase {
  id: string
  icon: string
  title: string
}

export type Booking
  = | (BookingBase & { type: 'flight', data: FlightData })
    | (BookingBase & { type: 'hotel', data: HotelData })
    | (BookingBase & { type: 'train', data: TrainData })
    | (BookingBase & { type: 'car', data: CarData })
    | (BookingBase & { type: 'attraction', data: AttractionData })
    | (BookingBase & { type: 'other', data: OtherData })

export type BookingType = Booking['type']

export interface BookingSectionContent {
  bookings: Booking[]
}
