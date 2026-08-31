export interface ChecklistSubtask {
  id: string
  text: string
  completed: boolean
}

export interface ChecklistTabConfig {
  id: string
  name: string
  icon: string
  isCustom?: boolean
}

export interface ChecklistGroup {
  id: string
  name: string
  icon?: string
  type?: string
}

export type ChecklistPriority = 1 | 2 | 3 | 4 | 5

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  type: string
  groupId?: string
  priority?: ChecklistPriority
  description?: string
  cost?: string
  location?: string
  link?: string
  tags?: string[]
  subtasks?: ChecklistSubtask[]
}

export interface ChecklistSectionContent {
  items?: ChecklistItem[]
  groups?: ChecklistGroup[]
  tabs?: ChecklistTabConfig[]
}
