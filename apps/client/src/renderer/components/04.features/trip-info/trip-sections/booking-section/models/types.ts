/**
 * Базовая структура для любого типа бронирования.
 */
export interface BookingBase {
  id: string
  icon: string
  title: string
}

/**
 * Интерфейс для хранения географических координат.
 */
export interface LocationCoords {
  lat: number
  lon: number
}

/**
 * Тип данных для одного сегмента авиаперелета.
 */
export interface FlightSegment {
  departureCity?: string
  arrivalCity?: string
  departureAirport?: string // IATA code
  arrivalAirport?: string // IATA code
  departureAirportLocation?: LocationCoords
  arrivalAirportLocation?: LocationCoords
  departureDateTime?: string // ISO 8601 format, e.g., '2025-10-18T22:40:00'
  arrivalDateTime?: string // ISO 8601 format, e.g., '2025-10-19T11:35:00'
  departureTimeZone?: string // Timezone offset, e.g., "+03:00"
  arrivalTimeZone?: string // Timezone offset, e.g., "+08:00"
  flightNumber?: string
  airline?: string
  airlineIataCode?: string
  aircraft?: string
  terminalDeparture?: string
  terminalArrival?: string
}

/**
 * Тип данных для авиаперелета. Теперь включает массив сегментов.
 */
export interface FlightData {
  bookingReference?: string
  notes?: string
  segments: FlightSegment[]
  sourceUrl?: string
}

/**
 * Тип данных для бронирования отеля.
 */
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

/**
 * Тип данных для билета на поезд.
 */
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

/**
 * Тип данных для билета на достопримечательность/мероприятие.
 */
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

// --- Общий тип бронирования ---

export type Booking
  = | (BookingBase & { type: 'flight', data: FlightData })
    | (BookingBase & { type: 'hotel', data: HotelData })
    | (BookingBase & { type: 'train', data: TrainData })
    | (BookingBase & { type: 'attraction', data: AttractionData })

export type BookingType = Booking['type']

export interface BookingSectionContent {
  bookings: Booking[]
}
