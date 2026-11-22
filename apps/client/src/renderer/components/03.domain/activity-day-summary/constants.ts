import type { ActivityType } from './types'

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  still: 'Покой',
  walk: 'Пешком',
  bike: 'Велосипед',
  vehicle: 'Авто',
  rail: 'Поезд',
  metro: 'Метро',
  ship: 'Судно',
  plane: 'Самолёт',
  cable_car: 'Канатная дорога',
  moto: 'Мото',
  unknown: 'Другое',
}

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  still: 'mdi:motion-pause-outline',
  walk: 'mdi:walk',
  bike: 'mdi:bike',
  vehicle: 'mdi:car-outline',
  rail: 'mdi:train',
  metro: 'mdi:subway-variant',
  ship: 'mdi:ferry',
  plane: 'mdi:airplane',
  cable_car: 'mdi:gondola',
  moto: 'mdi:motorbike',
  unknown: 'mdi:help-circle-outline',
}

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  still: '#9e9e9e',
  walk: '#4caf50',
  bike: '#ff9800',
  vehicle: '#2196f3',
  rail: '#ab47bc',
  metro: '#7959d5',
  ship: '#008f89',
  plane: '#a7548d',
  cable_car: '#9b631e',
  moto: '#d04a71',
  unknown: '#78909c',
}
