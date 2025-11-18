import type { Activity, ActivitySection, Day } from '~/shared/types/models/activity'

/**
 * Расширенный тип для секции активности, включающий кастомные поля для пинов.
 */
export interface CustomActivitySection extends ActivitySection {
  title?: string
  icon?: string
  color?: string
  isAttached?: boolean
}

/**
 * Группа секций, состоящая из родительской секции и прикрепленных к ней дочерних.
 */
export interface SectionGroup {
  parent: CustomActivitySection
  children: CustomActivitySection[]
}

export type IActivity = Activity
export type IDay = Day
