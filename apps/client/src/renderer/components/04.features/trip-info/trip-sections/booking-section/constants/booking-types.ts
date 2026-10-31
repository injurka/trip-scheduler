/**
 * Конфигурация для различных типов бронирований.
 * Определяет метки, иконки и заголовки по умолчанию.
 */
export const BOOKING_TYPES_CONFIG = {
  flight: { label: 'Авиаперелеты', icon: 'mdi:airplane', defaultTitle: 'Новый авиабилет' },
  hotel: { label: 'Отели', icon: 'mdi:hotel', defaultTitle: 'Новый отель' },
  train: { label: 'Поезда', icon: 'mdi:train', defaultTitle: 'Новый билет на поезд' },
  car: { label: 'Авто', icon: 'mdi:car', defaultTitle: 'Новый автомобиль' },
  attraction: { label: 'Места', icon: 'mdi:map-marker-star-outline', defaultTitle: 'Новое место' },
  other: { label: 'Другое', icon: 'mdi:dots-horizontal-circle-outline', defaultTitle: 'Новое перемещение' },
} as const
