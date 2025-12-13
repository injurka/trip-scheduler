import { FREE_PLAN_ID, ONE_GIGABYTE_IN_BYTES } from '~/lib/constants'

const SUBSCRIPTION_MOCK = [
  { id: `${FREE_PLAN_ID}`, name: 'Базовый', maxTrips: 3, maxStorageBytes: ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 50_000, isDeveloping: false },
  { id: `${2}`, name: 'Про', maxTrips: 15, maxStorageBytes: 25 * ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 1_000_000, isDeveloping: false },
  { id: `${3}`, name: 'Командный', maxTrips: 100, maxStorageBytes: 100 * ONE_GIGABYTE_IN_BYTES, monthlyLlmCredits: 5_000_000, isDeveloping: true },
]

export { SUBSCRIPTION_MOCK }
