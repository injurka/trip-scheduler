import { MOCK_USER_ID_3 } from 'db/mock/00.users'
import {
  getMemoriesPath as getMemoriesPathFromLib,
  getRoutePath as getRoutePathFromLib,
} from 'db/mock/data/lib/helpers'

export const TRIP_ID = 'f1e2d3c4-b5a6-9876-5432-10fedcba9876'
export const USER_ID = MOCK_USER_ID_3

// Хелпер для формирования путей к изображениям
export const getMemoriesPath = (filename: string) => getMemoriesPathFromLib(filename, TRIP_ID)
export const getRoutePath = (filename: string) => getRoutePathFromLib(filename, TRIP_ID)
