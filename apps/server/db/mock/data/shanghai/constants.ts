import { MOCK_USER_ID_1, MOCK_USER_ID_2 } from 'db/mock/00.users'
import {
  getMemoriesPath as getMemoriesPathFromLib,
  getRoutePath as getRoutePathFromLib,
} from 'db/mock/data/lib/helpers'

export const TRIP_ID = '3e8e2c7c-7a7b-4d43-9f5b-1a2c3d4e5f6a'
export const USER_ID_1 = MOCK_USER_ID_1
export const USER_ID_2 = MOCK_USER_ID_2

// Генерируем уникальные ID для каждого из 14 дней для согласованности
export const DAY_IDS = {
  DAY_01: crypto.randomUUID(),
  DAY_02: crypto.randomUUID(),
  DAY_03: crypto.randomUUID(),
  DAY_04: crypto.randomUUID(),
  DAY_05: crypto.randomUUID(),
  DAY_06: crypto.randomUUID(),
  DAY_07: crypto.randomUUID(),
  DAY_08: crypto.randomUUID(),
  DAY_09: crypto.randomUUID(),
  DAY_10: crypto.randomUUID(),
  DAY_11: crypto.randomUUID(),
  DAY_12: crypto.randomUUID(),
  DAY_13: crypto.randomUUID(),
  DAY_14: crypto.randomUUID(),
}

// Вспомогательные функции для создания корректных путей к статическим файлам
export const getMemoriesPath = (filename: string) => getMemoriesPathFromLib(filename, TRIP_ID)
export const getRoutePath = (filename: string) => getRoutePathFromLib(filename, TRIP_ID)
