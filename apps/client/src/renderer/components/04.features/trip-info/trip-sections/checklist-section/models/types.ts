/**
 * Определяет идентификатор вкладки чек-листа (стандартные или пользовательские).
 */
export type ChecklistTab = 'preparation' | 'in-trip' | string

/**
 * Уровень приоритета задачи от 1 (самый низкий) до 5 (самый высокий).
 */
export type ChecklistPriority = 1 | 2 | 3 | 4 | 5

/**
 * Подзадача элемента чек-листа.
 */
export interface ChecklistSubtask {
  id: string
  text: string
  completed: boolean
}

/**
 * Элемент чек-листа.
 */
export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  type: ChecklistTab // Tab ID
  groupId: string | null
  description?: string // Описание, заметка или гайд
  priority: ChecklistPriority // Приоритет задачи
  link?: string // Внешняя ссылка
  cost?: string // Ориентировочная стоимость (например, "~65 TWD / ~180 ₽")
  location?: string // Локация или адрес
  tags?: string[] // Теги (например, ["стритфуд", "тайбей"])
  subtasks?: ChecklistSubtask[] // Вложенные подпункты
}

/**
 * Группа для элементов чек-листа.
 */
export interface ChecklistGroup {
  id: string
  name: string
  icon: string
  type: ChecklistTab // Tab ID
}

/**
 * Конфигурация вкладки чек-листа.
 */
export interface ChecklistTabConfig {
  id: string
  name: string
  icon: string
  isCustom?: boolean
}

/**
 * Структура контента для секции чек-листа.
 */
export interface ChecklistSectionContent {
  items: ChecklistItem[]
  groups: ChecklistGroup[]
  tabs?: ChecklistTabConfig[]
}

export interface PresetItem {
  text: string
  priority?: ChecklistPriority
  description?: string
  cost?: string
  link?: string
  subtasks?: string[]
}

export interface PresetGroup {
  name: string
  icon: string
  items: PresetItem[]
}

export interface ChecklistPreset {
  id: string
  name: string
  description: string
  icon: string
  tab: ChecklistTab
  groups: PresetGroup[]
}
