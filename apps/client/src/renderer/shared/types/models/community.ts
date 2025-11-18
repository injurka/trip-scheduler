import type { RouterInput, RouterOutput } from '../trpc'

export type Community = RouterOutput['community']['list'][number]

export type CreateCommunityInput = RouterInput['community']['create']

export type ListCommunitiesInput = RouterInput['community']['list']

export enum CommunityPrivacy {
  PUBLIC = 'public',
  PRIVATE = 'private',
}
