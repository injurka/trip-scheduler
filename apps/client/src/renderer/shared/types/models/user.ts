import type { RouterInput, RouterOutput } from '../trpc'

export type User = RouterOutput['user']['me']

export type Highlight = RouterOutput['user']['getHighlights'][number]
export type CreateHighlightInput = RouterInput['user']['createHighlight']
