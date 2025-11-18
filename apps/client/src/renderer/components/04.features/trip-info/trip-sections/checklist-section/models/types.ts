/**
 * Определяет, к какому этапу путешествия относится задача или группа.
 */
export type ChecklistTab = 'preparation' | 'in-trip'

/**
 * Уровень приоритета задачи от 1 (самый низкий) до 5 (самый высокий).
 */
export type ChecklistPriority = 1 | 2 | 3 | 4 | 5

/**
 * Элемент чек-листа.
 */
export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  type: ChecklistTab
  groupId: string | null
  description?: string // Описание или заметка к задаче
  priority: ChecklistPriority // Приоритет задачи
  link?: string // Внешняя ссылка
}

/**
 * Группа для элементов чек-листа.
 */
export interface ChecklistGroup {
  id: string
  name: string
  icon: string
  type: ChecklistTab
}

/**
 * Структура контента для секции чек-листа.
 */
export interface ChecklistSectionContent {
  items: ChecklistItem[]
  groups: ChecklistGroup[]
}
