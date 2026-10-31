export interface LocationCoords {
  lat: number
  lon: number
}

export interface FlightSegment {
  departureCity?: string
  departureCityId?: string
  arrivalCity?: string
  arrivalCityId?: string
  departureAirport?: string
  arrivalAirport?: string
  departureAirportLocation?: LocationCoords
  arrivalAirportLocation?: LocationCoords
  departureDateTime?: string
  arrivalDateTime?: string
  departureTimeZone?: string
  arrivalTimeZone?: string
  flightNumber?: string
  airline?: string
  airlineIataCode?: string
  aircraft?: string
  terminalDeparture?: string
  terminalArrival?: string
  seat?: string
}

export interface FlightData {
  bookingReference?: string
  notes?: string
  segments?: FlightSegment[]
  sourceUrl?: string
}

export interface HotelData {
  hotelName?: string
  address?: string
  location?: LocationCoords
  checkInDate?: string
  checkOutDate?: string
  checkInTime?: string
  checkOutTime?: string
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
  departureDateTime?: string
  arrivalDateTime?: string
  departureTimeZone?: string
  arrivalTimeZone?: string
  trainNumber?: string
  carriage?: string
  seat?: string
  departurePlatform?: string
  arrivalPlatform?: string
  bookingReference?: string
  notes?: string
  sourceUrl?: string
}

export interface CarData {
  kind?: string
  company?: string
  carModel?: string
  carType?: string
  pickupLocation?: string
  pickupCoords?: LocationCoords
  dropoffLocation?: string
  dropoffCoords?: LocationCoords
  pickupDateTime?: string
  dropoffDateTime?: string
  pickupTimeZone?: string
  dropoffTimeZone?: string
  confirmationNumber?: string
  phone?: string
  email?: string
  notes?: string
  sourceUrl?: string
}

export interface AttractionData {
  attractionName?: string
  address?: string
  location?: LocationCoords
  dateTime?: string
  ticketType?: string
  guests?: string
  bookingReference?: string
  notes?: string
  sourceUrl?: string
}

export interface OtherData {
  kind?: string
  name?: string
  startLocation?: string
  endLocation?: string
  startCoords?: LocationCoords
  endCoords?: LocationCoords
  startDateTime?: string
  endDateTime?: string
  startTimeZone?: string
  endTimeZone?: string
  bookingReference?: string
  notes?: string
  sourceUrl?: string
}

export interface TripCalendarBooking {
  id: string
  title: string
  type: 'flight' | 'hotel' | 'train' | 'car' | 'attraction' | 'other' | string
  data: FlightData | HotelData | TrainData | CarData | AttractionData | OtherData | Record<string, any>
}

export interface TripCalendarActivitySection {
  type: string
  text?: string
  address?: string
  points?: Array<{ lat: number, lng?: number, lon?: number, label?: string, address?: string }>
  [key: string]: any
}

export interface TripCalendarActivity {
  id: string
  startTime: string
  endTime: string
  title: string
  tag?: string | null
  status?: string
  sections?: TripCalendarActivitySection[]
}

export interface TripCalendarDay {
  id: string
  date: string | null
  title: string
  description?: string | null
  meta?: Array<{ title: string, subtitle?: string | null }>
  activities?: TripCalendarActivity[]
}

export interface TripCalendarTrip {
  id: string
  title: string
  description?: string | null
  startDate: string
  endDate: string
  shareSlug?: string | null
  cityRefs?: Array<{ name: string, countryName?: string | null }>
  url?: string | null
}

export interface TripCalendarInput {
  trip: TripCalendarTrip
  days?: TripCalendarDay[]
  bookings?: TripCalendarBooking[]
}

export interface TripCalendarOptions {
  /**
   * Включать ли дни поездки как all-day события (целодневные события-вехи)
   * @default false
   */
  includeDaySummaries?: boolean

  /**
   * Включать ли запланированные активности и экскурсии дня
   * @default true
   */
  includeActivities?: boolean

  /**
   * Включать ли бронирования транспорта и билетов. Отели не создают события;
   * заселение и выезд экспортируются из активностей маршрута.
   * При включённых активностях бронирования дополняют только даты без плана дня.
   * @default true
   */
  includeBookings?: boolean

  /**
   * Настройка напоминаний (будильников) в минутах до события.
   * Если false, будильники не создаются.
   * @default true
   */
  enableAlarms?: boolean

  /**
   * Пользовательское имя календаря
   */
  calendarName?: string

  /**
   * Базовый веб-URL для ссылок на события в Trip Scheduler
   */
  baseUrl?: string
}
