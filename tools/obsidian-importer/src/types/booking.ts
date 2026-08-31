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

export interface CarData {
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

export type BookingType = Booking['type']

export interface BookingSectionContent {
  bookings: Booking[]
}
