import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/utils'

export interface CalloutDefinition {
  type: string
  label: string
  iconSvg: string
  colorClass: string
}

export const CALLOUT_DEFINITIONS: Record<string, CalloutDefinition> = {
  tip: {
    type: 'tip',
    label: 'Совет',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
    colorClass: 'milkdown-callout-tip',
  },
  hint: {
    type: 'hint',
    label: 'Подсказка',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
    colorClass: 'milkdown-callout-tip',
  },
  note: {
    type: 'note',
    label: 'Заметка',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    colorClass: 'milkdown-callout-note',
  },
  info: {
    type: 'info',
    label: 'Информация',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    colorClass: 'milkdown-callout-note',
  },
  important: {
    type: 'important',
    label: 'Важно',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    colorClass: 'milkdown-callout-important',
  },
  warning: {
    type: 'warning',
    label: 'Внимание',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    colorClass: 'milkdown-callout-warning',
  },
  warn: {
    type: 'warn',
    label: 'Предупреждение',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    colorClass: 'milkdown-callout-warning',
  },
  caution: {
    type: 'caution',
    label: 'Осторожно',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    colorClass: 'milkdown-callout-caution',
  },
  danger: {
    type: 'danger',
    label: 'Опасно',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    colorClass: 'milkdown-callout-caution',
  },
  success: {
    type: 'success',
    label: 'Успешно',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    colorClass: 'milkdown-callout-tip',
  },
  question: {
    type: 'question',
    label: 'Вопрос',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    colorClass: 'milkdown-callout-question',
  },
  todo: {
    type: 'todo',
    label: 'Задачи',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    colorClass: 'milkdown-callout-todo',
  },
  example: {
    type: 'example',
    label: 'Пример',
    iconSvg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    colorClass: 'milkdown-callout-example',
  },
}

function getCalloutDef(typeKey: string): CalloutDefinition {
  const normalized = typeKey.toLowerCase()
  if (CALLOUT_DEFINITIONS[normalized]) {
    return CALLOUT_DEFINITIONS[normalized]
  }
  return {
    type: normalized,
    label: typeKey.toUpperCase(),
    iconSvg: CALLOUT_DEFINITIONS.note.iconSvg,
    colorClass: 'milkdown-callout-note',
  }
}

const CALLOUT_REGEX = /^\s*\[!([a-z]+)[+-]?\]/i

export const calloutPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('milkdownCallouts'),
    props: {
      decorations(state) {
        const decorations: Decoration[] = []

        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'blockquote')
            return

          const firstChild = node.firstChild
          if (!firstChild || !firstChild.isTextblock)
            return

          const firstText = firstChild.textContent
          const match = firstText.match(CALLOUT_REGEX)
          if (!match)
            return

          const rawType = match[1]
          const calloutDef = getCalloutDef(rawType)

          // 1. Add callout card class to blockquote node
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              'class': `milkdown-callout ${calloutDef.colorClass}`,
              'data-callout-type': calloutDef.type,
            }),
          )

          // 2. Locate tag position inside first child text
          const matchIndex = firstText.indexOf(`[!${rawType}`)
          if (matchIndex !== -1) {
            const firstChildTextStart = pos + 2
            const tagStart = firstChildTextStart + matchIndex
            const bracketClose = firstText.indexOf(']', matchIndex)
            const baseTagEnd = bracketClose !== -1 ? firstChildTextStart + bracketClose + 1 : tagStart + match[0].length

            let whitespaceLen = 0
            const closeIdx = bracketClose !== -1 ? bracketClose + 1 : matchIndex + match[0].length
            while (firstText[closeIdx + whitespaceLen] === ' ') {
              whitespaceLen++
            }
            const tagEndWithSpace = baseTagEnd + whitespaceLen

            // Hide the raw [!TYPE] marker in view
            decorations.push(
              Decoration.inline(tagStart, tagEndWithSpace, {
                class: 'milkdown-callout-tag',
              }),
            )

            // If the first paragraph is only the tag (and spaces), collapse it
            const remainder = firstText.slice(closeIdx + whitespaceLen).trim()
            if (!remainder) {
              decorations.push(
                Decoration.node(pos + 1, pos + 1 + firstChild.nodeSize, {
                  class: 'milkdown-callout-lead-empty',
                }),
              )
            }
          }

          // 3. Add stylish header banner at the top of the blockquote
          const widget = Decoration.widget(
            pos + 1,
            () => {
              const header = document.createElement('div')
              header.className = 'milkdown-callout-header'
              header.contentEditable = 'false'

              const iconBadge = document.createElement('span')
              iconBadge.className = 'milkdown-callout-icon-badge'
              iconBadge.innerHTML = calloutDef.iconSvg

              const title = document.createElement('span')
              title.className = 'milkdown-callout-title'
              title.textContent = calloutDef.label

              header.appendChild(iconBadge)
              header.appendChild(title)
              return header
            },
            { side: -1, key: `callout-header-${pos}` },
          )

          decorations.push(widget)
        })

        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
})
