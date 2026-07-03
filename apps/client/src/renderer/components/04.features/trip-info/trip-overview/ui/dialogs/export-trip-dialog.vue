<script setup lang="ts">
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import type { BookingSectionContent, ChecklistSectionContent, FinancesSectionContent } from '~/components/04.features/trip-info/trip-sections'
import type { ActivitySectionText } from '~/shared/types/models/activity'
import type { Trip, TripSection } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { EActivitySectionType } from '~/shared/types/models/activity'
import { TripSectionType } from '~/shared/types/models/trip'

interface Props {
  visible: boolean
  trip: Trip
  days: IDay[]
  sections: TripSection[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

type ExportFormat = 'json' | 'text'

const selectedFormat = ref<ExportFormat>('text')
const isExporting = ref(false)

const options = ref({
  includeActivityDetails: true, // Текстовые заметки внутри активностей
  includeDayMeta: true, // Мета-информация дня (бейджи)
  includeBookings: true, // Секция бронирований
  includeChecklist: true, // Секция чек-листа
  includeFinances: true, // Секция финансов
})

const formats = [
  { id: 'text', label: 'Plain Text', description: 'Читаемый текстовый формат. Удобно для заметок и мессенджеров.', icon: 'mdi:text-box-outline' },
  { id: 'json', label: 'JSON', description: 'Структурированные данные. Подходит для резервного копирования.', icon: 'mdi:code-json' },
]

function stripMarkdown(text: string): string {
  if (!text)
    return ''

  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    .replace(/^#+\s/gm, '') // Headers
    .trim()
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(amount)
}

function getBookingsText(sections: TripSection[]): string[] {
  const bookingSection = sections.find(s => s.type === TripSectionType.BOOKINGS)
  if (!bookingSection)
    return []

  const content = bookingSection.content as BookingSectionContent
  const lines: string[] = []
  lines.push('\n--- БРОНИРОВАНИЯ ---')

  if (!content.bookings || content.bookings.length === 0) {
    lines.push('  Нет бронирований')
    return lines
  }

  content.bookings.forEach((b) => {
    lines.push(`• ${b.title} (${b.type.toUpperCase()})`)

    if (b.type === 'flight') {
      const segs = b.data.segments || []
      if (segs.length) {
        const first = segs[0]
        const last = segs[segs.length - 1]
        lines.push(`  ${first.departureCity} -> ${last.arrivalCity}`)
        lines.push(`  Вылет: ${first.departureDateTime?.replace('T', ' ')}`)
      }
    }
    else if (b.type === 'hotel') {
      lines.push(`  Отель: ${b.data.hotelName}`)
      lines.push(`  Заезд: ${b.data.checkInDate} | Выезд: ${b.data.checkOutDate}`)
    }
    else if (b.type === 'train') {
      lines.push(`  Откуда: ${b.data.departureStation}`)
      lines.push(`  Куда: ${b.data.arrivalStation}`)
      lines.push(`  Отправление: ${b.data.departureDateTime?.replace('T', ' ')}`)
    }
  })
  return lines
}

function getChecklistText(sections: TripSection[]): string[] {
  const checklistSection = sections.find(s => s.type === TripSectionType.CHECKLIST)
  if (!checklistSection)
    return []

  const content = checklistSection.content as ChecklistSectionContent
  const lines: string[] = []
  lines.push('\n--- ЧЕК-ЛИСТ ---')

  const groups = content.groups || []
  const items = content.items || []

  const groupedItems: Record<string, typeof items> = {}
  items.forEach((item) => {
    const gid = item.groupId || 'ungrouped'
    if (!groupedItems[gid])
      groupedItems[gid] = []
    groupedItems[gid].push(item)
  })

  groups.forEach((g) => {
    const gItems = groupedItems[g.id]
    if (gItems && gItems.length > 0) {
      lines.push(`\n[${g.name.toUpperCase()}]`)
      gItems.forEach((i) => {
        const status = i.completed ? '[x]' : '[ ]'
        lines.push(`  ${status} ${i.text}`)
      })
    }
  })

  if (groupedItems.ungrouped && groupedItems.ungrouped.length > 0) {
    lines.push('\n[ПРОЧЕЕ]')
    groupedItems.ungrouped.forEach((i) => {
      const status = i.completed ? '[x]' : '[ ]'
      lines.push(`  ${status} ${i.text}`)
    })
  }

  return lines
}

function getFinancesText(sections: TripSection[]): string[] {
  const financeSection = sections.find(s => s.type === TripSectionType.FINANCES)
  if (!financeSection)
    return []

  const content = financeSection.content as FinancesSectionContent
  const lines: string[] = []
  lines.push('\n--- ФИНАНСЫ ---')

  const total = content.transactions.reduce((acc, tx) => acc + tx.amount, 0)
  const currency = content.settings.mainCurrency || 'RUB'

  lines.push(`Итого расходов: ~${formatCurrency(total, currency)}`)
  lines.push('\nТранзакции:')
  content.transactions.forEach((tx) => {
    lines.push(`  - ${tx.title}: ${formatCurrency(tx.amount, tx.currency)}`)
  })

  return lines
}

function generateTextContent(): string {
  const { trip, days, sections } = props
  const lines: string[] = []

  lines.push(`${trip.title.toUpperCase()}`)
  const start = new Date(trip.startDate).toLocaleDateString('ru-RU')
  const end = new Date(trip.endDate).toLocaleDateString('ru-RU')
  lines.push(`📅 Даты: ${start} - ${end}`)
  if (trip.cities.length)
    lines.push(`📍 Города: ${trip.cities.join(', ')}`)

  if (trip.description) {
    lines.push(`\n📝 Описание:\n${stripMarkdown(trip.description)}`)
  }

  lines.push(`\n${'='.repeat(30)}`)

  if (options.value.includeBookings) {
    lines.push(...getBookingsText(sections))
  }
  if (options.value.includeChecklist) {
    lines.push(...getChecklistText(sections))
  }
  if (options.value.includeFinances) {
    lines.push(...getFinancesText(sections))
  }

  lines.push(`\n${'='.repeat(30)}\n`)
  lines.push('--- МАРШРУТ ПО ДНЯМ ---')

  days.forEach((day, index) => {
    const date = new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    lines.push(`\nДЕНЬ ${index + 1}: ${day.title || 'Без названия'} (${date})`)

    if (day.description)
      lines.push(`  > ${stripMarkdown(day.description)}`)

    if (options.value.includeDayMeta && day.meta && day.meta.length > 0) {
      const metaStrings = day.meta.map(m => `${m.title}: ${m.subtitle || ''}`).join(' | ')
      lines.push(`  [Инфо: ${metaStrings}]`)
    }

    if (day.activities.length > 0) {
      day.activities.forEach((act) => {
        lines.push(`  ● [${act.startTime} - ${act.endTime}] ${act.title}`)

        if (options.value.includeActivityDetails && act.sections) {
          act.sections.forEach((sec) => {
            if (sec.type === EActivitySectionType.DESCRIPTION) {
              const textSec = sec as ActivitySectionText
              if (textSec.text) {
                const cleanText = stripMarkdown(textSec.text).replace(/\n/g, '\n    ')
                lines.push(`    ${cleanText}`)
              }
            }
          })
        }
      })
    }
    else {
      lines.push('  Нет запланированных активностей')
    }
  })

  return lines.join('\n')
}

function handleExport() {
  isExporting.value = true
  try {
    const { trip, days, sections } = props
    let content = ''
    let mimeType = ''
    let extension = ''

    if (selectedFormat.value === 'json') {
      const filteredSections = sections.filter((s) => {
        if (s.type === TripSectionType.BOOKINGS && !options.value.includeBookings)
          return false
        if (s.type === TripSectionType.CHECKLIST && !options.value.includeChecklist)
          return false
        if (s.type === TripSectionType.FINANCES && !options.value.includeFinances)
          return false
        return true
      })

      const data = {
        trip,
        days: days.map(d => ({
          ...d,
        })),
        sections: filteredSections,
        exportedAt: new Date().toISOString(),
      }
      content = JSON.stringify(data, null, 2)
      mimeType = 'application/json'
      extension = 'json'
    }
    else if (selectedFormat.value === 'text') {
      content = generateTextContent()
      mimeType = 'text/plain'
      extension = 'txt'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    // eslint-disable-next-line regexp/no-obscure-range
    const sanitizedTitle = trip.title.replace(/[^a-zа-яё0-9]/gi, '_').toLowerCase()
    link.href = url
    link.download = `trip_${sanitizedTitle}_${new Date().toISOString().split('T')[0]}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    emit('update:visible', false)
  }
  catch (e) {
    console.error('Export failed', e)
  }
  finally {
    isExporting.value = false
  }
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Экспорт путешествия"
    icon="mdi:export-variant"
    :max-width="600"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="export-dialog-content">
      <p class="description">
        Выберите формат и состав данных для сохранения на ваше устройство.
      </p>

      <div class="formats-list">
        <div
          v-for="format in formats"
          :key="format.id"
          class="format-option"
          :class="{ active: selectedFormat === format.id }"
          @click="selectedFormat = format.id as ExportFormat"
        >
          <div class="radio-indicator">
            <div v-if="selectedFormat === format.id" class="radio-dot" />
          </div>
          <div class="format-info">
            <div class="format-header">
              <Icon :icon="format.icon" class="format-icon" />
              <span class="format-label">{{ format.label }}</span>
            </div>
            <p class="format-description">
              {{ format.description }}
            </p>
          </div>
        </div>
      </div>

      <KitDivider />

      <div class="export-settings">
        <h4 class="settings-title">
          Состав экспорта
        </h4>
        <div class="settings-grid">
          <KitCheckbox v-model="options.includeActivityDetails">
            Содержимое активностей (заметки)
          </KitCheckbox>
          <KitCheckbox v-model="options.includeDayMeta">
            Мета-информация дня
          </KitCheckbox>
          <KitCheckbox v-model="options.includeBookings">
            Раздел "Бронирования"
          </KitCheckbox>
          <KitCheckbox v-model="options.includeChecklist">
            Раздел "Чек-лист"
          </KitCheckbox>
          <KitCheckbox v-model="options.includeFinances">
            Раздел "Финансы"
          </KitCheckbox>
        </div>
      </div>

      <div class="dialog-actions">
        <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn :loading="isExporting" @click="handleExport">
          <Icon icon="mdi:download-outline" />
          Скачать
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.export-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 0.5rem;
}

.description {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.95rem;
  line-height: 1.5;
}

.formats-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.format-option {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  cursor: pointer;
  background-color: var(--bg-secondary-color);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
  }

  &.active {
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--fg-accent-color-rgb), 0.05);

    .radio-indicator {
      border-color: var(--fg-accent-color);
    }
  }
}

.radio-indicator {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: border-color 0.2s ease;

  .radio-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--fg-accent-color);
  }
}

.format-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.format-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.format-icon {
  font-size: 1.2rem;
  color: var(--fg-primary-color);
}

.format-label {
  font-weight: 600;
  color: var(--fg-primary-color);
}

.format-description {
  margin: 0;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  line-height: 1.3;
}

.export-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
