import type { RouterInput, RouterOutput } from '../trpc'

// Автоматически выводим типы из tRPC роутера
export type Country = RouterOutput['destinationReview']['getCountries'][number]
export type DestinationReview = RouterOutput['destinationReview']['getUserReviews'][number]

export type CreateDestinationReviewInput = RouterInput['destinationReview']['create']
