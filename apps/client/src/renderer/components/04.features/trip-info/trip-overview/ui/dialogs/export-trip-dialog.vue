<script setup lang="ts">
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import type { BookingSectionContent, ChecklistSectionContent, FinancesSectionContent } from '~/components/04.features/trip-info/trip-sections'
import type { ActivitySectionText } from '~/shared/types/models/activity'
import type { Trip, TripSection } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { generateTripCalendarIcs } from '@injurka/trip-calendar'
import { useClipboard } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { isTauri } from '~/shared/lib/env'
import { openExternalUrl } from '~/shared/lib/opener'
import { getTripCalendarUrl, toWebcalUrl } from '~/shared/lib/url'
import { EActivitySectionType } from '~/shared/types/models/activity'
import { TripSectionType } from '~/shared/types/models/trip'

interface Props {
  visible: boolean
  trip: Trip
  days: IDay[]
  sections: TripSection[]
}
type ExportFormat = 'json' | 'text' | 'ics'
interface FormatOption {
  id: ExportFormat
  label: string
  badge: string
  description: string
  icon: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const toast = useToast()
const { copy } = useClipboard()

const selectedFormat = ref<ExportFormat>('text')
const isExporting = ref(false)
const options = ref({
  includeActivityDetails: true, // Текстовые заметки внутри активностей
  includeDayMeta: true, // Мета-информация дня (бейджи)
  includeBookings: true, // Секция бронирований
  includeChecklist: true, // Секция чек-листа
  includeFinances: true, // Секция финансов
})

type OptionKey = keyof typeof options.value
interface ExportItemOption {
  key: OptionKey
  label: string
  hint: string
  icon: string
}

const formats: FormatOption[] = [
  {
    id: 'text',
    label: 'Plain Text',
    badge: '.TXT',
    description: 'Читаемый текстовый формат. Удобно для заметок и пересылки в мессенджерах.',
    icon: 'mdi:text-box-outline',
  },
  {
    id: 'json',
    label: 'JSON',
    badge: '.JSON',
    description: 'Структурированные данные. Подходит для полного резервного копирования.',
    icon: 'mdi:code-json',
  },
  {
    id: 'ics',
    label: 'Календарь',
    badge: '.ICS',
    description: 'События для Apple Calendar, Google Calendar, Outlook и WebCal.',
    icon: 'mdi:calendar-month-outline',
  },
]
const resolvedShareSlug = ref<string | null>(props.trip.shareSlug || null)

const currentExportItems = computed<ExportItemOption[]>(() => {
  if (selectedFormat.value === 'ics') {
    return [
      {
        key: 'includeActivityDetails',
        label: 'Активности и экскурсии',
        hint: 'События с точным временем',
        icon: 'mdi:clock-outline',
      },
      {
        key: 'includeDayMeta',
        label: 'Дни путешествия',
        hint: 'Целодневные сводные события',
        icon: 'mdi:calendar-range-outline',
      },
      {
        key: 'includeBookings',
        label: 'Бронирования',
        hint: 'Рейсы, поезда и заселение в отели',
        icon: 'mdi:ticket-percent-outline',
      },
    ]
  }

  return [
    {
      key: 'includeActivityDetails',
      label: 'Заметки активностей',
      hint: 'Тексты и описания внутри дел',
      icon: 'mdi:text-box-search-outline',
    },
    {
      key: 'includeDayMeta',
      label: 'Мета-информация дня',
      hint: 'Теги, бейджи и локации',
      icon: 'mdi:tag-multiple-outline',
    },
    {
      key: 'includeBookings',
      label: 'Раздел «Бронирования»',
      hint: 'Отели, транспорт и ваучеры',
      icon: 'mdi:book-multiple-outline',
    },
    {
      key: 'includeChecklist',
      label: 'Раздел «Чек-лист»',
      hint: 'Списки задач и сборов',
      icon: 'mdi:format-list-checks',
    },
    {
      key: 'includeFinances',
      label: 'Раздел «Финансы»',
      hint: 'Бюджет и список расходов',
      icon: 'mdi:cash-multiple',
    },
  ]
})
const selectedItemsCount = computed(() => {
  return currentExportItems.value.filter(item => options.value[item.key]).length
})
const isAllSelected = computed(() => {
  return selectedItemsCount.value === currentExportItems.value.length
})

watch(() => props.trip.shareSlug, (nextSlug) => {
  if (nextSlug)
    resolvedShareSlug.value = nextSlug
})

watch(() => props.visible, (visible) => {
  if (visible) {
    void ensureCalendarIdentifier()
  }
}, { immediate: true })

function toggleAllItems() {
  const nextVal = !isAllSelected.value

  for (const item of currentExportItems.value) {
    options.value[item.key] = nextVal
  }
}
async function ensureCalendarIdentifier(): Promise<string> {
  if (resolvedShareSlug.value)
    return resolvedShareSlug.value

  if (props.trip.visibility === 'private') {
    const slug = await useRequest({
      key: `trip-export:share-slug:${props.trip.id}`,
      fn: db => db.trips.getOrCreateShareSlug(props.trip.id),
    })

    if (slug) {
      resolvedShareSlug.value = slug

      return slug
    }
  }

  return props.trip.id
}
async function resolveCalendarUrl(): Promise<string> {
  return getTripCalendarUrl(await ensureCalendarIdentifier())
}
async function copyCalendarLink() {
  copy(await resolveCalendarUrl())
  toast.success('Ссылка на календарь скопирована')
}
async function openWebcalSubscription() {
  const httpUrl = await resolveCalendarUrl()
  const webcalUrl = toWebcalUrl(httpUrl)

  // На случай, если в системе нет обработчика webcal:// — ссылка всегда копируется
  copy(httpUrl)
  toast.info('Открываем календарь. Если ничего не произошло — ссылка скопирована, добавьте её вручную как подписку.')

  if (isTauri) {
    await openExternalUrl(webcalUrl)

    return
  }

  // window.open после await блокируется как popup, а для кастомной схемы нужна именно навигация
  window.location.assign(webcalUrl)
}
async function openGoogleCalendarSubscription() {
  const httpUrl = await resolveCalendarUrl()
  const subscribeUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(toWebcalUrl(httpUrl))}`

  await openExternalUrl(subscribeUrl)
}
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
  lines.push('\n--- ЧЕК-ЛИСТЫ ---')

  const tabs = content.tabs || [
    { id: 'preparation', name: 'Подготовка', icon: 'mdi:briefcase' },
    { id: 'in-trip', name: 'В путешествии', icon: 'mdi:map-marker-path' },
  ]
  const groups = content.groups || []
  const items = content.items || []

  tabs.forEach((tab) => {
    const tabItems = items.filter(i => i.type === tab.id)

    if (tabItems.length === 0)
      return

    lines.push(`\n=== [ВКЛАДКА: ${tab.name.toUpperCase()}] ===`)

    const tabGroups = groups.filter(g => g.type === tab.id)
    const groupedItems: Record<string, typeof items> = {}

    tabItems.forEach((item) => {
      const gid = item.groupId || 'ungrouped'

      if (!groupedItems[gid])
        groupedItems[gid] = []

      groupedItems[gid].push(item)
    })

    tabGroups.forEach((g) => {
      const gItems = groupedItems[g.id]

      if (gItems && gItems.length > 0) {
        lines.push(`\n[${g.name.toUpperCase()}]`)
        gItems.forEach((i) => {
          const status = i.completed ? '[x]' : '[ ]'
          let line = `  ${status} ${i.text}`

          if (i.cost)
            line += ` (💰 ${i.cost})`

          if (i.location)
            line += ` (📍 ${i.location})`

          lines.push(line)

          if (i.description)
            lines.push(`     Заметка: ${i.description}`)

          if (i.subtasks && i.subtasks.length > 0) {
            i.subtasks.forEach((sub) => {
              const subStatus = sub.completed ? '[x]' : '[ ]'
              lines.push(`     └─ ${subStatus} ${sub.text}`)
            })
          }
        })
      }
    })

    if (groupedItems.ungrouped && groupedItems.ungrouped.length > 0) {
      lines.push('\n[ПРОЧИЕ ЗАДАЧИ]')
      groupedItems.ungrouped.forEach((i) => {
        const status = i.completed ? '[x]' : '[ ]'
        let line = `  ${status} ${i.text}`

        if (i.cost)
          line += ` (💰 ${i.cost})`

        if (i.location)
          line += ` (📍 ${i.location})`

        lines.push(line)

        if (i.description)
          lines.push(`     Заметка: ${i.description}`)

        if (i.subtasks && i.subtasks.length > 0) {
          i.subtasks.forEach((sub) => {
            const subStatus = sub.completed ? '[x]' : '[ ]'
            lines.push(`     └─ ${subStatus} ${sub.text}`)
          })
        }
      })
    }
  })

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
  const cityEntries = [...(trip.cityRefs ?? []).map(place => ({ position: place.position, name: place.name, countryName: place.countryName }))]
    .sort((a, b) => a.position - b.position)

  if (cityEntries.length) {
    const counts = new Map<string, number>()

    for (const city of cityEntries)
      counts.set(city.name, (counts.get(city.name) ?? 0) + 1)

    const labels = cityEntries.map(city => (counts.get(city.name) ?? 0) > 1 && city.countryName
      ? `${city.name} · ${city.countryName}`
      : city.name)
    lines.push(`📍 Города: ${labels.join(', ')}`)
  }

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
    const date = day.date
      ? new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
      : 'Черновик'
    const header = day.date
      ? `\nДЕНЬ ${index + 1}: ${day.title || 'Без названия'} (${date})`
      : `\nЧЕРНОВИК: ${day.title || 'Без названия'}`
    lines.push(header)

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
    else if (selectedFormat.value === 'ics') {
      const bookingSection = sections.find(s => s.type === TripSectionType.BOOKINGS)
      const bookings = (bookingSection?.content as BookingSectionContent)?.bookings || []

      content = generateTripCalendarIcs({
        trip: {
          id: trip.id,
          title: trip.title,
          description: trip.description,
          startDate: trip.startDate,
          endDate: trip.endDate,
          shareSlug: trip.shareSlug,
          cityRefs: trip.cityRefs,
          url: window.location.href,
        },
        days: days as any,
        bookings: bookings as any,
      }, {
        includeBookings: options.value.includeBookings,
        includeActivities: options.value.includeActivityDetails,
        includeDaySummaries: options.value.includeDayMeta,
        calendarName: trip.title,
      })
      mimeType = 'text/calendar;charset=utf-8'
      extension = 'ics'
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
    description="Выберите формат и состав данных для сохранения на ваше устройство."
    :max-width="580"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="export-dialog-content">
      <!-- 1. Секция выбора формата -->
      <section class="dialog-section">
        <div class="section-header">
          <span class="section-title">Формат файла</span>
        </div>

        <div class="formats-grid">
          <div
            v-for="format in formats"
            :key="format.id"
            class="format-card"
            :class="{ 'is-active': selectedFormat === format.id }"
            role="button"
            tabindex="0"
            :aria-pressed="selectedFormat === format.id"
            @click="selectedFormat = format.id"
            @keydown.space.prevent="selectedFormat = format.id"
            @keydown.enter.prevent="selectedFormat = format.id"
          >
            <div class="format-card-top">
              <div class="format-icon-box">
                <Icon :icon="format.icon" />
              </div>
              <span class="format-badge">{{ format.badge }}</span>
            </div>

            <div class="format-card-main">
              <div class="format-title-row">
                <span class="format-title">{{ format.label }}</span>
                <Icon v-if="selectedFormat === format.id" icon="mdi:check-circle" class="format-active-icon" />
              </div>
              <p class="format-desc">
                {{ format.description }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Секция состава данных для экспорта -->
      <section class="dialog-section">
        <div class="section-header">
          <div class="section-title-group">
            <span class="section-title">Состав экспорта</span>
            <span class="section-count">{{ selectedItemsCount }} из {{ currentExportItems.length }}</span>
          </div>

          <button
            type="button"
            class="section-action-btn"
            @click="toggleAllItems"
          >
            {{ isAllSelected ? 'Снять все' : 'Выбрать все' }}
          </button>
        </div>

        <div class="export-items-grid">
          <div
            v-for="item in currentExportItems"
            :key="item.key"
            class="export-item-tile"
            :class="{ 'is-selected': options[item.key] }"
            role="checkbox"
            :aria-checked="options[item.key]"
            tabindex="0"
            @click="options[item.key] = !options[item.key]"
            @keydown.space.prevent="options[item.key] = !options[item.key]"
            @keydown.enter.prevent="options[item.key] = !options[item.key]"
          >
            <div class="tile-icon-box">
              <Icon :icon="item.icon" />
            </div>
            <div class="tile-info">
              <span class="tile-label">{{ item.label }}</span>
              <span class="tile-hint">{{ item.hint }}</span>
            </div>
            <div class="tile-checkbox" :class="{ 'is-checked': options[item.key] }">
              <Icon v-if="options[item.key]" icon="mdi:check" class="check-icon" />
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Карточка синхронизации WebCal (для формата календаря) -->
      <section v-if="selectedFormat === 'ics'" class="dialog-section">
        <div class="webcal-card">
          <div class="webcal-content">
            <div class="webcal-icon-box">
              <Icon icon="mdi:calendar-sync" />
            </div>
            <div class="webcal-text">
              <div class="webcal-title-row">
                <span class="webcal-title">Синхронизация по ссылке (WebCal)</span>
                <span class="webcal-badge">Live</span>
              </div>
              <p class="webcal-description">
                Подпишитесь в Apple Calendar, Google Calendar или Outlook — изменения в путешествии обновятся автоматически.
              </p>
            </div>
          </div>

          <div class="webcal-actions">
            <KitBtn
              size="sm"
              icon="mdi:calendar-plus"
              @click="openWebcalSubscription"
            >
              Подписаться
            </KitBtn>
            <KitBtn
              size="sm"
              variant="outlined"
              icon="mdi:google"
              @click="openGoogleCalendarSubscription"
            >
              Google Календарь
            </KitBtn>
            <KitBtn
              size="sm"
              variant="outlined"
              color="secondary"
              icon="mdi:content-copy"
              @click="copyCalendarLink"
            >
              Копировать ссылку
            </KitBtn>
          </div>
        </div>
      </section>
    </div>

    <!-- Стандартизированный футер KitDialogWithClose -->
    <template #footer>
      <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
        Отмена
      </KitBtn>
      <KitBtn
        icon="mdi:download-outline"
        :disabled="isExporting || selectedItemsCount === 0"
        @click="handleExport"
      >
        {{ selectedFormat === 'ics' ? 'Скачать .ics' : selectedFormat === 'json' ? 'Скачать .json' : 'Скачать .txt' }}
      </KitBtn>
    </template>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.export-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0 2px;
}

.dialog-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  min-height: 24px;
}

.section-title-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg-secondary-color);
}

.section-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  background-color: color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
  padding: 1px 7px;
  border-radius: var(--r-full);
}

.section-action-btn {
  background: transparent;
  border: none;
  padding: 2px 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  cursor: pointer;
  border-radius: var(--r-2xs, 4px);
  transition:
    background-color 0.15s ease,
    opacity 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
  }
}

// Карточки форматов
.formats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.format-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  cursor: pointer;
  position: relative;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.15s ease,
    box-shadow 0.2s ease;
  user-select: none;
  outline: none;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
    transform: translateY(-1px);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--fg-accent-color);
  }

  &.is-active {
    border-color: var(--fg-accent-color);
    background-color: color-mix(in srgb, var(--fg-accent-color) 6%, var(--bg-secondary-color));
    box-shadow: 0 0 0 1px var(--fg-accent-color);

    .format-icon-box {
      background-color: color-mix(in srgb, var(--fg-accent-color) 16%, transparent);
      color: var(--fg-accent-color);
    }

    .format-badge {
      background-color: color-mix(in srgb, var(--fg-accent-color) 18%, transparent);
      color: var(--fg-accent-color);
      border-color: color-mix(in srgb, var(--fg-accent-color) 30%, transparent);
    }
  }
}

.format-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.format-icon-box {
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.format-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: var(--r-2xs, 4px);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  border: 1px solid transparent;
  letter-spacing: 0.04em;
  transition: all 0.2s ease;
}

.format-card-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.format-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.format-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.25;
}

.format-active-icon {
  font-size: 1.05rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
}

.format-desc {
  margin: 0;
  font-size: 0.775rem;
  line-height: 1.35;
  color: var(--fg-secondary-color);
}

// Плитки состава данных
.export-items-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.export-item-tile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
  outline: none;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--fg-accent-color);
  }

  &.is-selected {
    border-color: color-mix(in srgb, var(--fg-accent-color) 45%, var(--border-secondary-color));
    background-color: color-mix(in srgb, var(--fg-accent-color) 6%, var(--bg-secondary-color));

    .tile-icon-box {
      color: var(--fg-accent-color);
      background-color: color-mix(in srgb, var(--fg-accent-color) 14%, transparent);
    }
  }

  &:last-child:nth-child(odd) {
    grid-column: span 2;

    @include media-down(sm) {
      grid-column: span 1;
    }
  }
}

.tile-icon-box {
  width: 32px;
  height: 32px;
  border-radius: var(--r-xs);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.tile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.tile-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-hint {
  font-size: 0.725rem;
  color: var(--fg-secondary-color);
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-checkbox {
  width: 18px;
  height: 18px;
  border-radius: var(--r-2xs, 4px);
  border: 1.5px solid var(--border-primary-color);
  background-color: var(--bg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s ease;
  font-size: 0.85rem;
  color: var(--fg-inverted-color);

  &.is-checked {
    background-color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

// Карточка WebCal
.webcal-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  transition: border-color 0.2s ease;
}

.webcal-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.webcal-icon-box {
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  background-color: color-mix(in srgb, var(--fg-accent-color) 14%, transparent);
  color: var(--fg-accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.webcal-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.webcal-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.webcal-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.webcal-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 6px;
  border-radius: var(--r-full);
  background-color: color-mix(in srgb, var(--fg-accent-color) 15%, transparent);
  color: var(--fg-accent-color);
}

.webcal-description {
  margin: 0;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
}

.webcal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 2px;
}
</style>
