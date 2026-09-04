import type {
  ChecklistGroup,
  ChecklistItem,
  ChecklistPriority,
  ChecklistSectionContent,
  ChecklistTabConfig,
} from '../types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

export function detectIconForGroup(groupName: string): string {
  const text = groupName.toLowerCase()

  if (/🪪|документ|паспорт|виз|страхов|въезд/.test(text))
    return 'mdi:card-account-details-outline'
  if (/💳|финанс|деньг|валют|карт|easycard|оплат/.test(text))
    return 'mdi:credit-card-outline'
  if (/💻|воркейшн|ноутбук|техник|it|электроник|гаджет/.test(text))
    return 'mdi:laptop'
  if (/📱|софт|приложен|приложени|esim|связь|vpn/.test(text))
    return 'mdi:cellphone-cog'
  if (/💊|аптечк|здоров|медицин|лекарств|таблетк/.test(text))
    return 'mdi:pill'
  if (/👕|гардероб|одежд|обув|слои|куртк|дождевик/.test(text))
    return 'mdi:tshirt-crew-outline'
  if (/🎒|снаряжен|багаж|рюкзак|чемодан|вещи/.test(text))
    return 'mdi:bag-personal-outline'
  if (/🚨|таможн|запрет|правил|штраф/.test(text))
    return 'mdi:alert-octagon-outline'
  if (/⏳|таймлайн|готовност|предполетн|срок/.test(text))
    return 'mdi:timeline-clock-outline'
  if (/🏮|стритфуд|ночной рынок|рынок|закуск/.test(text))
    return 'mdi:food'
  if (/🍲|специалитет|блюд|деликатес|утка|говядин|суп|лапша/.test(text))
    return 'mdi:pot-steam'
  if (/🍵|чай|чайная|напитк|boba|bubble tea|гунфу/.test(text))
    return 'mdi:tea'
  if (/🥭|фрукт|десерт|бингсу|морожен/.test(text))
    return 'mdi:fruit-cherries'
  if (/🌊|природ|остров|снорклинг|онсэн|термал|пляж/.test(text))
    return 'mdi:waves'
  if (/⛩️|культур|храм|традици|лотере|гадан|фич/.test(text))
    return 'mdi:torii-gate'
  if (/🍃|улун|коллекци|лишан|алишан/.test(text))
    return 'mdi:leaf'
  if (/🍍|выпечк|сладост|фэнлису|тайянбин|пирог/.test(text))
    return 'mdi:cake-variant'
  if (/🥃|виски|алкогол|kavalan|пиво/.test(text))
    return 'mdi:glass-cocktail'
  if (/🛍️|шопинг|покупк|подарк|сувенир/.test(text))
    return 'mdi:shopping-outline'
  if (/🧴|косметик|уход|маск/.test(text))
    return 'mdi:lotion-outline'

  return 'mdi:checkbox-marked-circle-outline'
}

export function extractCostFromText(text: string): string | undefined {
  const match = text.match(/\((?:💰|~)?\s*([~≈]?\s*(?:\d[\s\d]*[–—\-]\s*\d+|\d[\s\d]*)\s*(?:TWD|NT\$|[₽$€¥₩]|USD|EUR|CNY|KRW)(?:\s*\/[^)]+)?)\)/i)
  if (match)
    return match[1].trim()

  const plainMatch = text.match(/`(~?\s*\d[\s\d]*(?:[–—\-]\d[\s\d]*)?(?:TWD|₽|\$|USD|EUR))`/)
  if (plainMatch)
    return plainMatch[1].trim()

  return undefined
}

export function extractLocationFromText(text: string): string | undefined {
  const match = text.match(/\*(?:Где пробовать|Локация|Место|Где искать|Где купить):\*\s*([^;\n)]+)/i)
  if (match) {
    return match[1].split('(`')[0].split('(`')[0].trim().replace(/\s*\(~.*$/, '')
  }
  return undefined
}

export function extractLinkFromText(text: string): string | undefined {
  const mdMatch = text.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i)
  if (mdMatch)
    return mdMatch[2]

  const urlMatch = text.match(/(?:https?:\/\/|www\.)[^\s)]+/i)
  if (urlMatch) {
    let url = urlMatch[0].replace(/[`*,;.]+$/, '')
    if (!url.startsWith('http'))
      url = `https://${url}`
    return url
  }

  const portalMatch = text.match(/`([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s`]*)?)`/i)
  if (portalMatch) {
    return `https://${portalMatch[1]}`
  }

  return undefined
}

export function detectPriorityFromText(text: string): ChecklistPriority {
  if (/🚨|❌|запрещен|штраф|критическ|обязательн|строго/i.test(text))
    return 5
  if (/⚡|важно|рекомендует|высок/i.test(text))
    return 4
  if (/\[P5\]/i.test(text))
    return 5
  if (/\[P4\]/i.test(text))
    return 4
  if (/\[P3\]/i.test(text))
    return 3
  if (/\[P2\]/i.test(text))
    return 2
  if (/\[P1\]/i.test(text))
    return 1

  return 1
}

export function routeTabFromTitle(title: string): string | undefined {
  const matches: string[] = []
  if (/must-try|что попробовать|гастрономи|вкус/i.test(title))
    matches.push('must-try')
  if (/must-buy|шопинг|покупки|сувенир/i.test(title))
    matches.push('must-buy')
  if (/must-do|активност|впечатлен/i.test(title))
    matches.push('must-do')

  // Composite titles (e.g. master navigation pages like
  // «Чек-листы: Подготовка, Сборы, Must-Try и Покупки») span multiple
  // categories — they must not claim a single custom tab; keep the default.
  return matches.length === 1 ? matches[0] : undefined
}

const CUSTOM_TAB_META: Record<string, { name: string, icon: string }> = {
  'must-try': { name: 'Must-Try: Гастрономия', icon: 'mdi:noodles' },
  'must-buy': { name: 'Must-Buy: Шопинг', icon: 'mdi:shopping-outline' },
  'must-do': { name: 'Must-Do: Впечатления', icon: 'mdi:compass-outline' },
}

function ensureCustomTab(tabs: ChecklistTabConfig[], tabId: string): void {
  const meta = CUSTOM_TAB_META[tabId]
  if (meta && !tabs.some(t => t.id === tabId))
    tabs.push({ id: tabId, name: meta.name, icon: meta.icon, isCustom: true })
}

export function parseObsidianChecklists(checklistDirOrFiles: string[] | string): ChecklistSectionContent {
  const filePaths: string[] = []

  if (typeof checklistDirOrFiles === 'string') {
    if (existsSync(checklistDirOrFiles)) {
      if (statSync(checklistDirOrFiles).isDirectory()) {
        const files = readdirSync(checklistDirOrFiles).filter(f => f.endsWith('.md'))
        for (const file of files) {
          filePaths.push(join(checklistDirOrFiles, file))
        }
      }
      else {
        filePaths.push(checklistDirOrFiles)
      }
    }
  }
  else if (Array.isArray(checklistDirOrFiles)) {
    filePaths.push(...checklistDirOrFiles.filter(f => existsSync(f)))
  }

  if (filePaths.length === 0) {
    return {
      tabs: [
        { id: 'preparation', name: 'Подготовка и сборы', icon: 'mdi:briefcase-check-outline', isCustom: false },
        { id: 'in-trip', name: 'В путешествии', icon: 'mdi:map-marker-path', isCustom: false },
      ],
      groups: [],
      items: [],
    }
  }

  const tabs: ChecklistTabConfig[] = []
  const groups: ChecklistGroup[] = []
  const items: ChecklistItem[] = []

  // Ensure default base tabs
  const defaultPrepTab: ChecklistTabConfig = {
    id: 'preparation',
    name: 'Подготовка и сборы',
    icon: 'mdi:briefcase-check-outline',
    isCustom: false,
  }
  tabs.push(defaultPrepTab)

  for (const filePath of filePaths) {
    const fileName = basename(filePath)
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    let currentTabId = 'preparation'
    let inFencedCodeBlock = false

    const fileTabId = routeTabFromTitle(fileName)
    if (fileTabId) {
      currentTabId = fileTabId
      ensureCustomTab(tabs, fileTabId)
    }

    let currentH2GroupId: string | undefined
    let currentGroupId: string | undefined
    let currentItem: ChecklistItem | null = null

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const rawLine = lines[lineIndex]
      const trimmed = rawLine.trim()

      if (!trimmed)
        continue

      // Skip fenced code blocks (```/~~~) and blockquotes/callouts (`>`),
      // so mermaid mindmaps and tip-callout summaries don't pollute tabs
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        inFencedCodeBlock = !inFencedCodeBlock
        continue
      }
      if (inFencedCodeBlock || trimmed.startsWith('>'))
        continue

      // H1 Header
      if (rawLine.startsWith('# ') && !rawLine.startsWith('## ')) {
        const title = rawLine.replace(/^#\s*/, '').replace(/^[^\wА-Яа-яёЁ]+/, '').trim()
        const tabId = routeTabFromTitle(title)
        if (tabId) {
          currentTabId = tabId
          currentH2GroupId = undefined
          currentGroupId = undefined
          ensureCustomTab(tabs, tabId)
        }
        continue
      }

      // H2 Header
      if (rawLine.startsWith('## ') && !rawLine.startsWith('### ')) {
        const cleanH2 = rawLine.replace(/^##\s*/, '').trim()

        const sectionTabId = routeTabFromTitle(cleanH2)
        if (sectionTabId) {
          currentTabId = sectionTabId
          currentH2GroupId = undefined
          currentGroupId = undefined
          ensureCustomTab(tabs, sectionTabId)
          continue
        }

        const icon = detectIconForGroup(cleanH2)
        const groupTitle = cleanH2
          .replace(/^[\p{Extended_Pictographic}\p{Symbol}\s\uFE00-\uFE0F\u200D\d.)\-]+/gu, '')
          .trim() || cleanH2
        const groupId = crypto.randomUUID()

        groups.push({
          id: groupId,
          name: groupTitle,
          icon,
          type: currentTabId,
        })
        currentH2GroupId = groupId
        currentGroupId = groupId
        currentItem = null
        continue
      }

      // H3 Header
      if (rawLine.startsWith('### ')) {
        const rawH3 = rawLine.replace(/^###\s*/, '').trim()

        if (currentTabId === 'must-try' || currentTabId === 'must-buy' || currentTabId === 'must-do' || !currentH2GroupId) {
          const icon = detectIconForGroup(rawH3)
          const groupTitle = rawH3
            .replace(/^[\p{Extended_Pictographic}\p{Symbol}\s\uFE00-\uFE0F\u200D\d.)\-]+/gu, '')
            .trim() || rawH3
          const groupId = crypto.randomUUID()

          groups.push({
            id: groupId,
            name: groupTitle,
            icon,
            type: currentTabId,
          })
          currentGroupId = groupId
        }
        else {
          currentGroupId = currentH2GroupId
        }
        currentItem = null
        continue
      }

      // Checkbox line: `- [ ]` or `- [x]`
      const taskMatch = rawLine.match(/^(\s*)[-*+]\s+\[([ x])\]\s+(\S.*)$/i)
      if (taskMatch) {
        const indent = taskMatch[1].length
        const isChecked = taskMatch[2].toLowerCase() === 'x'
        const taskText = taskMatch[3].trim()

        if (indent >= 2 && currentItem) {
          if (!currentItem.subtasks)
            currentItem.subtasks = []

          currentItem.subtasks.push({
            id: crypto.randomUUID(),
            text: taskText.replace(/^[*_`]+|[*_`]+$/g, '').trim(),
            completed: isChecked,
          })
          continue
        }

        const priority = detectPriorityFromText(taskText)
        const cost = extractCostFromText(taskText)
        const location = extractLocationFromText(taskText)
        const link = extractLinkFromText(taskText)

        let cleanText = taskText.replace(/\[P[1-5]\]/gi, '').trim()
        let description: string | undefined

        const colonMatch = cleanText.match(/^(\*\*[^*]+\*\*:?)\s*(\S.*)$/)
        if (colonMatch && colonMatch[2].trim()) {
          cleanText = colonMatch[1]
          description = colonMatch[2].trim()
        }

        const newItem: ChecklistItem = {
          id: crypto.randomUUID(),
          text: cleanText,
          completed: isChecked,
          type: currentTabId,
          groupId: currentGroupId,
          priority,
          description,
          cost,
          location,
          link,
          subtasks: [],
        }

        items.push(newItem)
        currentItem = newItem
        continue
      }

      // Indented description bullet
      if (currentItem && /^(\s{2,}|\t)[-*+]\s+/.test(rawLine)) {
        const descText = rawLine.replace(/^(\s{2,}|\t)[-*+]\s+/, '').trim()

        const costInDesc = extractCostFromText(descText)
        if (costInDesc && !currentItem.cost)
          currentItem.cost = costInDesc

        const locInDesc = extractLocationFromText(descText)
        if (locInDesc && !currentItem.location)
          currentItem.location = locInDesc

        const linkInDesc = extractLinkFromText(descText)
        if (linkInDesc && !currentItem.link)
          currentItem.link = linkInDesc

        if (currentItem.description) {
          currentItem.description += `\n${descText}`
        }
        else {
          currentItem.description = descText
        }
      }
    }
  }

  const populatedGroups = groups.filter(g => items.some(i => i.groupId === g.id))
  const populatedTabs = tabs.filter(t => items.some(i => i.type === t.id))
  if (populatedTabs.length === 0) {
    populatedTabs.push({ id: 'preparation', name: 'Подготовка и сборы', icon: 'mdi:briefcase-check-outline', isCustom: false })
  }

  return {
    tabs: populatedTabs,
    groups: populatedGroups,
    items,
  }
}
