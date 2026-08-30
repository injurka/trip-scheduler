import type {
  ChecklistGroup,
  ChecklistItem,
  ChecklistPriority,
  ChecklistSubtask,
  ChecklistTabConfig,
} from '../models/types'
import { v4 as uuidv4 } from 'uuid'

export interface ParsedMarkdownResult {
  tabs: ChecklistTabConfig[]
  groups: ChecklistGroup[]
  items: ChecklistItem[]
  stats: {
    tabsCount: number
    groupsCount: number
    itemsCount: number
    subtasksCount: number
  }
}

/**
 * Словарь сопоставления эмодзи или ключевых слов с иконками Iconify (mdi:*).
 */
const ICON_MAP: Record<string, string> = {
  '🪪': 'mdi:card-account-details-outline',
  '📄': 'mdi:file-document-outline',
  '💳': 'mdi:credit-card-outline',
  '💻': 'mdi:laptop',
  '🔌': 'mdi:power-plug-outline',
  '📱': 'mdi:cellphone',
  '💊': 'mdi:pill',
  '🤢': 'mdi:emoticon-sick-outline',
  '🦟': 'mdi:bug-outline',
  '🍜': 'mdi:noodles',
  '🩹': 'mdi:bandage',
  '❄️': 'mdi:snowflake',
  '👕': 'mdi:tshirt-crew-outline',
  '👟': 'mdi:shoe-sneaker',
  '🩳': 'mdi:hanger',
  '🌲': 'mdi:pine-tree',
  '🤿': 'mdi:diving-snorkel',
  '🎒': 'mdi:bag-personal-outline',
  '🚨': 'mdi:alert-octagon-outline',
  '❌': 'mdi:close-octagon-outline',
  '⏳': 'mdi:timer-sand',
  '🗓️': 'mdi:calendar-clock',
  '🛫': 'mdi:airplane-takeoff',
  '✈️': 'mdi:airplane',
  '🏨': 'mdi:bed-outline',
  '🚆': 'mdi:train',
  '🥟': 'mdi:food',
  '🍲': 'mdi:pot-steam-outline',
  '🦆': 'mdi:food-drumstick',
  '🍵': 'mdi:tea',
  '🥭': 'mdi:fruit-pineapple',
  '🎯': 'mdi:bullseye-arrow',
  '🌊': 'mdi:water',
  '🐢': 'mdi:turtle',
  '🌅': 'mdi:weather-sunset',
  '♨️': 'mdi:hot-tub',
  '🏙️': 'mdi:city-variant-outline',
  '🚡': 'mdi:gondola',
  '📖': 'mdi:book-open-page-variant-outline',
  '🛍️': 'mdi:shopping-outline',
  '🍃': 'mdi:leaf',
  '🍍': 'mdi:fruit-pineapple',
  '🥃': 'mdi:glass-cocktail',
  '🧴': 'mdi:lotion-plus-outline',
  '💎': 'mdi:diamond-stone',
  '🛄': 'mdi:bag-suitcase-outline',
  '💡': 'mdi:lightbulb-on-outline',
  '⭐': 'mdi:star-outline',
  '✅': 'mdi:checkbox-marked-circle-outline',
  '🧭': 'mdi:compass-outline',
  '⚡': 'mdi:flash',
  '🧳': 'mdi:bag-suitcase',
}

/**
 * Извлекает иконку по эмодзи в тексте или возвращает дефолтную.
 */
function extractIconFromText(text: string, defaultIcon = 'mdi:tag-outline'): string {
  for (const [emoji, icon] of Object.entries(ICON_MAP)) {
    if (text.includes(emoji)) {
      return icon
    }
  }

  const lower = text.toLowerCase()
  if (lower.includes('документ') || lower.includes('паспорт'))
    return 'mdi:passport'
  if (lower.includes('билет') || lower.includes('авиа'))
    return 'mdi:airplane'
  if (lower.includes('отел') || lower.includes('жиль'))
    return 'mdi:bed-outline'
  if (lower.includes('аптечк') || lower.includes('медицин') || lower.includes('здоров'))
    return 'mdi:medical-bag'
  if (lower.includes('техник') || lower.includes('воркейшн') || lower.includes('электроник'))
    return 'mdi:laptop'
  if (lower.includes('одежд') || lower.includes('гардероб'))
    return 'mdi:tshirt-crew-outline'
  if (lower.includes('еда') || lower.includes('кухн') || lower.includes('вкус') || lower.includes('стритфуд'))
    return 'mdi:noodles'
  if (lower.includes('покупк') || lower.includes('шопинг') || lower.includes('сувенир'))
    return 'mdi:shopping-outline'
  if (lower.includes('активност') || lower.includes('впечатлен') || lower.includes('опыт'))
    return 'mdi:compass-outline'
  if (lower.includes('запрет') || lower.includes('таможн') || lower.includes('важно') || lower.includes('критическ'))
    return 'mdi:alert-octagon-outline'
  if (lower.includes('таймлайн') || lower.includes('готовност') || lower.includes('дедлайн'))
    return 'mdi:clock-outline'
  if (lower.includes('финанс') || lower.includes('деньг') || lower.includes('карт'))
    return 'mdi:credit-card-outline'

  return defaultIcon
}

/**
 * Очищает название группы от лишних служебных символов Markdown.
 */
function cleanHeadingName(raw: string): string {
  return raw
    .replace(/^#+\s*/, '')
    .replace(/^[\d.]+\s*/, '')
    .trim()
}

/**
 * Определяет приоритет задачи по ключевым маркерам.
 */
function detectPriority(text: string): ChecklistPriority {
  const lower = text.toLowerCase()
  if (text.includes('🚨') || text.includes('❌') || text.includes('[P5]') || lower.includes('критически') || lower.includes('строжайш'))
    return 5
  if (text.includes('⚡') || text.includes('⭐') || text.includes('[P4]') || lower.includes('обязательн') || lower.includes('важно'))
    return 4
  if (text.includes('[P3]'))
    return 3
  if (text.includes('[P2]'))
    return 2
  return 1
}

/**
 * Извлекает ссылки из строки (Markdown [text](url) или обычные URL).
 */
function extractLink(text: string): string | undefined {
  const mdLinkMatch = text.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/)
  if (mdLinkMatch)
    return mdLinkMatch[1]

  const rawUrlMatch = text.match(/(https?:\/\/[^\s"'>]+)/)
  if (rawUrlMatch)
    return rawUrlMatch[1]

  // Ссылки вида `domain.com` в бэктиках
  const backtickDomainMatch = text.match(/`([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s`]*)?)`/i)
  if (backtickDomainMatch)
    return `https://${backtickDomainMatch[1]}`

  return undefined
}

/**
 * Извлекает ориентировочную стоимость из строки.
 */
function extractCost(text: string): string | undefined {
  const costMatch = text.match(/(`?~?[\d\s.,–-]+(?:TWD|NT\$|[₽$€¥]|USD|EUR|руб|THB|AUD)[^\n`)]*`?)/i)
  if (costMatch) {
    return costMatch[1].replace(/`/g, '').trim()
  }
  return undefined
}

/**
 * Извлекает локацию из строки (например "Где пробовать: ...").
 */
function extractLocation(text: string): string | undefined {
  const locMatch = text.match(/\*Где (?:пробовать|покупать):\*\s*([^(\n]+)/i)
  if (locMatch) {
    return locMatch[1].replace(/[*_`]/g, '').trim()
  }
  return undefined
}

/**
 * Парсер сырого Markdown в структуру чек-листа с вкладками, группами и вложенными подзадачами.
 */
export function parseMarkdownToChecklist(
  markdownText: string,
  targetTabId = 'preparation',
  mode: 'current-tab' | 'auto-tabs' = 'current-tab',
): ParsedMarkdownResult {
  const lines = markdownText.split('\n')

  const tabs: ChecklistTabConfig[] = []
  const groups: ChecklistGroup[] = []
  const items: ChecklistItem[] = []

  let currentTabId = targetTabId
  let currentGroupId: string | null = null
  let currentItem: ChecklistItem | null = null

  // Вспомогательная функция регистрации вкладки
  function ensureTab(name: string, icon = 'mdi:tag-outline'): string {
    const cleanName = cleanHeadingName(name)
    const existing = tabs.find(t => t.name.toLowerCase() === cleanName.toLowerCase())
    if (existing)
      return existing.id

    const id = `tab_${uuidv4().slice(0, 8)}`
    tabs.push({
      id,
      name: cleanName,
      icon: extractIconFromText(name, icon),
      isCustom: true,
    })
    return id
  }

  // Вспомогательная функция регистрации группы
  function ensureGroup(name: string, tabId: string): string {
    const cleanName = cleanHeadingName(name)
    const existing = groups.find(g => g.name.toLowerCase() === cleanName.toLowerCase() && g.type === tabId)
    if (existing)
      return existing.id

    const id = uuidv4()
    groups.push({
      id,
      name: cleanName,
      icon: extractIconFromText(name),
      type: tabId,
    })
    return id
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed)
      continue

    // Пропуск mermaid-блоков и таблиц
    if (trimmed.startsWith('```') || trimmed.startsWith('|')) {
      continue
    }

    // 1. Заголовок # H1 — В режиме auto-tabs может становиться новой вкладкой
    if (/^#\s+[^#]/.test(rawLine)) {
      if (mode === 'auto-tabs') {
        const tabTitle = rawLine.replace(/^#\s+/, '')
        currentTabId = ensureTab(tabTitle, 'mdi:briefcase-check-outline')
        currentGroupId = null
        currentItem = null
      }
      continue
    }

    // 2. Заголовок ## H2 или ### H3 — создание группы
    if (/^#{2,4}\s+/.test(rawLine)) {
      const groupTitle = rawLine.replace(/^#{2,4}\s+/, '')
      currentGroupId = ensureGroup(groupTitle, currentTabId)
      currentItem = null
      continue
    }

    // 3. Элемент списка с чекбоксом: `- [ ]` или `- [x]`
    const taskMatch = rawLine.match(/^(\s*)[-*+]\s+\[([ x])\]\s+(\S.*)$/i)
    if (taskMatch) {
      const indent = taskMatch[1].length
      const isChecked = taskMatch[2].toLowerCase() === 'x'
      const taskText = taskMatch[3].trim()

      // Если есть отступ (2+ пробелов) и есть активная родительская задача — считаем подзадачей
      if (indent >= 2 && currentItem) {
        if (!currentItem.subtasks)
          currentItem.subtasks = []

        const subtask: ChecklistSubtask = {
          id: uuidv4(),
          text: taskText.replace(/^[*_`]+|[*_`]+$/g, '').trim(),
          completed: isChecked,
        }
        currentItem.subtasks.push(subtask)
        continue
      }

      // Главная задача
      const priority = detectPriority(taskText)
      const link = extractLink(taskText)
      const cost = extractCost(taskText)
      const location = extractLocation(taskText)

      // Очищаем текст задачи от служебных префиксов [P1] и т.д.
      let cleanText = taskText
        .replace(/\[P[1-5]\]/gi, '')
        .trim()

      // Если в задаче есть описание через двоеточие или перенос, выделяем
      let description: string | undefined

      // Проверка на вид: **Заголовок:** Описание
      const colonMatch = cleanText.match(/^(\*\*[^*]+\*\*:?)\s*(\S.*)$/)
      if (colonMatch && colonMatch[2].trim()) {
        cleanText = colonMatch[1]
        description = colonMatch[2].trim()
      }

      const newItem: ChecklistItem = {
        id: uuidv4(),
        text: cleanText,
        completed: isChecked,
        type: currentTabId,
        groupId: currentGroupId,
        priority,
        link,
        cost,
        location,
        description,
        subtasks: [],
      }

      items.push(newItem)
      currentItem = newItem
      continue
    }

    // 4. Вложенные описания к текущей задаче (например `- *Что это:* ...` или `  - *Где пробовать:* ...`)
    if (currentItem && (rawLine.startsWith('  ') || rawLine.startsWith('\t') || rawLine.startsWith('- *'))) {
      const descLine = trimmed.replace(/^[-*+]\s+/, '').trim()

      // Извлечение цены/локации из строки описания
      const lineCost = extractCost(descLine)
      if (lineCost && !currentItem.cost) {
        currentItem.cost = lineCost
      }

      const lineLocation = extractLocation(descLine)
      if (lineLocation && !currentItem.location) {
        currentItem.location = lineLocation
      }

      const lineLink = extractLink(descLine)
      if (lineLink && !currentItem.link) {
        currentItem.link = lineLink
      }

      if (currentItem.description) {
        currentItem.description += `\n${descLine}`
      }
      else {
        currentItem.description = descLine
      }
    }
  }

  const subtasksCount = items.reduce((acc, item) => acc + (item.subtasks?.length || 0), 0)

  return {
    tabs,
    groups,
    items,
    stats: {
      tabsCount: tabs.length,
      groupsCount: groups.length,
      itemsCount: items.length,
      subtasksCount,
    },
  }
}
