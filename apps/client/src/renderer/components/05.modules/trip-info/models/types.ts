import type { Activity, Day } from '~/shared/types/models/activity'
import type { Memory } from '~/shared/types/models/memory'
import { EActivityTag } from '~/shared/types/models/activity'

export type ImageQuality = 'small' | 'medium' | 'large' | 'original'
export type ActiveView = 'plan' | 'memories' | 'split'
export type InteractionMode = 'view' | 'edit'
export type IMemory = Memory
export type IActivity = Activity
export type IDay = Day
export { EActivityTag }
