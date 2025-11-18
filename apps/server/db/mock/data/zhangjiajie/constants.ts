import { MOCK_USER_ID_1 } from 'db/mock/00.users'
import {
  getMemoriesPath as getMemoriesPathFromLib,
  getRoutePath as getRoutePathFromLib,
} from 'db/mock/data/lib/helpers'

export const TRIP_ID = 'c0417422-b266-4242-91e8-f9a7d852a9fd'
export const USER_ID = MOCK_USER_ID_1

// Используем ID дней из исходного JSON
export const DAY_IDS = {
  DAY_01: '6d579741-3b24-4d6f-8ca1-3fa26fc0e1f0',
  DAY_02: '06fb16c2-edb7-41d3-a3a7-4adf3c066c0d',
  DAY_03: '7b852fc8-c54f-4510-b337-e8d81371f71d',
  DAY_04: '8a8248ab-b061-49bf-9abb-65207257a667',
  DAY_05: '41fb99f6-e7a6-4d9e-be04-c9fc7d6eda9a',
  DAY_06: 'd2c1b2a3-f4e5-4d6c-8b9a-0c1d2e3f4a5b',
  DAY_07: 'e3d2c1b4-a5f6-4e7d-9c0b-1d2e3f4a5b6c',
  DAY_08: 'f4e3d2c5-b6a7-4f8e-a0d1-2e3f4a5b6c7d',
  DAY_09: 'a5f4e3d6-c7b8-4a9f-b1e2-3f4a5b6c7d8e',
  DAY_10: '32bcabf2-fa72-43f5-8a45-269dc59dea0b',
  DAY_11: 'd2e50cb1-8a59-41bc-a015-d06f260c62b0',
  DAY_12: '0e320e56-ff56-47d2-86d4-b4e2eb6a0f20',
  DAY_13: '4c333329-34a9-408e-b9b0-eda1979e5aba',
  DAY_14: '7a269a77-6621-4518-a819-c85de6d1f009',
  DAY_15: 'a8e8ea55-a1f4-4bab-9ae3-e05557860e09',
}

// Хелпер для формирования путей к изображениям
export const getMemoriesPath = (filename: string) => getMemoriesPathFromLib(filename, TRIP_ID)
export const getRoutePath = (filename: string) => getRoutePathFromLib(filename, TRIP_ID)
