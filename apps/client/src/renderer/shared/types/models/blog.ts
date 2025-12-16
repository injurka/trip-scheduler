import type { RouterOutput } from '../trpc'

export type BlogPost = RouterOutput['blog']['getBySlug']
export type BlogListItems = RouterOutput['blog']['list']['items'][number]
