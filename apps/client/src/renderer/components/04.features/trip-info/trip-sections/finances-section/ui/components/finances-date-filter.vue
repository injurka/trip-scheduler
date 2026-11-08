<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import {
  endOfMonth,
  getLocalTimeZone,
  parseDate,
  startOfMonth,
  today,
} from '@internationalized/date'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { KitBottomSheet } from '~/components/01.kit/kit-bottom-sheet'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendarRange } from '~/components/01.kit/kit-calendar-range'
import { useDisplay } from '~/shared/composables/use-display'
import { formatDate } from '~/shared/lib/date-time'

interface DateFilterValue {
  start: string | null
  end: string | null
}
interface Props {
  minValue?: DateValue
  maxValue?: DateValue
}
interface Preset {
  id: string
  label: string
  getRange: () => { start: DateValue | null, end: DateValue | null }
}
interface CalendarRangeValue {
  start: DateValue | null
  end: DateValue | null
}

const props = defineProps<Props>()
const model = defineModel<DateFilterValue>({ required: true })

const { smAndDown: isMobile } = useDisplay()

const isMobileOpen = ref(false)
const isDesktopOpen = ref(false)
const draftStart = shallowRef<DateValue | null>(null)
const draftEnd = shallowRef<DateValue | null>(null)

const draftCalendarModel = computed<CalendarRangeValue>({
  get: () => ({
    start: draftStart.value,
    end: draftEnd.value,
  }),
  set: (val: CalendarRangeValue | null) => {
    draftStart.value = val ? val.start : null
    draftEnd.value = val ? val.end : null
  },
})

const focusDate = computed<DateValue>(() => {
  return draftEnd.value
    || draftStart.value
    || props.maxValue
    || today(getLocalTimeZone())
})
const presets = computed<Preset[]>(() => {
  const tz = getLocalTimeZone()
  const now = today(tz)

  return [
    {
      id: 'today',
      label: 'Сегодня',
      getRange: () => ({
        start: now,
        end: now,
      }),
    },
    {
      id: 'week',
      label: '7 дней',
      getRange: () => ({
        start: now.subtract({ days: 6 }),
        end: now,
      }),
    },
    {
      id: 'month',
      label: 'Этот месяц',
      getRange: () => ({
        start: startOfMonth(now),
        end: endOfMonth(now),
      }),
    },
    {
      id: 'all',
      label: 'Всё время',
      getRange: () => ({
        start: null,
        end: null,
      }),
    },
  ]
})
const formattedDateFilter = computed(() => {
  const { start, end } = model.value

  if (!start && !end)
    return 'За все время'

  const format = (dateStr: string) => formatDate(dateStr, { month: 'short', day: 'numeric' })

  if (start && end) {
    if (start === end)
      return format(start)

    return `${format(start)} - ${format(end)}`
  }

  if (start)
    return `С ${format(start)}`

  if (end)
    return `До ${format(end)}`

  return 'За все время'
})
const hasActiveFilter = computed(() => !!model.value.start || !!model.value.end)

watch(isMobileOpen, (open) => {
  if (open)
    initDraft()
})
watch(isDesktopOpen, (open) => {
  if (open)
    initDraft()
})

function initDraft() {
  draftStart.value = model.value.start ? parseDate(model.value.start) : null
  draftEnd.value = model.value.end ? parseDate(model.value.end) : null
}
function openMobile() {
  initDraft()
  isMobileOpen.value = true
}
function isPresetActive(preset: Preset): boolean {
  const range = preset.getRange()
  const curStart = draftStart.value ? draftStart.value.toString() : null
  const curEnd = draftEnd.value ? draftEnd.value.toString() : null
  const pStart = range.start ? range.start.toString() : null
  const pEnd = range.end ? range.end.toString() : null

  return curStart === pStart && curEnd === pEnd
}
function selectPreset(preset: Preset) {
  const range = preset.getRange()
  draftStart.value = range.start
  draftEnd.value = range.end
}
function formatDisplayDate(date: DateValue | null | undefined): string {
  if (!date)
    return '—'

  const day = String(date.day).padStart(2, '0')
  const month = String(date.month).padStart(2, '0')
  const year = date.year

  return `${day}.${month}.${year}`
}
function handleApply() {
  model.value = {
    start: draftStart.value ? draftStart.value.toString() : null,
    end: draftEnd.value ? draftEnd.value.toString() : null,
  }
  isMobileOpen.value = false
  isDesktopOpen.value = false
}
function handleReset() {
  draftStart.value = null
  draftEnd.value = null
  model.value = { start: null, end: null }
  isMobileOpen.value = false
  isDesktopOpen.value = false
}
</script>

<template>
  <div class="finances-date-filter">
    <!-- Мобильное представление: Кнопка + KitBottomSheet -->
    <template v-if="isMobile">
      <KitBtn
        icon="mdi:calendar-blank-outline"
        variant="tonal"
        size="sm"
        class="date-filter-btn"
        :class="{ 'has-active-filter': hasActiveFilter }"
        @click="openMobile"
      >
        <span class="date-filter-label">{{ formattedDateFilter }}</span>
      </KitBtn>

      <KitBottomSheet
        v-model="isMobileOpen"
        title="Выбрать период"
        max-height="90dvh"
      >
        <div class="sheet-content">
          <!-- Сводка выбранного диапазона -->
          <div class="date-range-summary">
            <div class="range-card">
              <span class="range-card-label">Начало</span>
              <span class="range-card-value">{{ formatDisplayDate(draftStart) }}</span>
            </div>
            <div class="range-card">
              <span class="range-card-label">Конец</span>
              <span class="range-card-value">{{ formatDisplayDate(draftEnd) }}</span>
            </div>
          </div>

          <!-- Быстрые пресеты -->
          <div class="presets-row">
            <button
              v-for="preset in presets"
              :key="preset.id"
              type="button"
              class="preset-pill"
              :class="{ 'is-active': isPresetActive(preset) }"
              @click="selectPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>

          <!-- Календарь на всю ширину экрана -->
          <div class="calendar-container">
            <KitCalendarRange
              v-model="draftCalendarModel"
              :full-width="true"
              :min-value="props.minValue"
              :max-value="props.maxValue"
              :initial-focus-date="focusDate"
            />
          </div>
        </div>

        <template #footer>
          <div class="sheet-footer-actions">
            <KitBtn
              variant="tonal"
              size="md"
              class="footer-btn reset-btn"
              @click="handleReset"
            >
              Сбросить
            </KitBtn>
            <KitBtn
              variant="solid"
              size="md"
              class="footer-btn apply-btn"
              @click="handleApply"
            >
              Применить
            </KitBtn>
          </div>
        </template>
      </KitBottomSheet>
    </template>

    <!-- Десктопное представление: Popover с компактным календарем -->
    <template v-else>
      <PopoverRoot v-model:open="isDesktopOpen">
        <PopoverTrigger as-child>
          <KitBtn
            icon="mdi:calendar-blank-outline"
            variant="tonal"
            size="sm"
            class="date-filter-btn"
            :class="{ 'has-active-filter': hasActiveFilter }"
          >
            <span class="date-filter-label">{{ formattedDateFilter }}</span>
          </KitBtn>
        </PopoverTrigger>

        <PopoverPortal>
          <PopoverContent
            side="bottom"
            align="end"
            :side-offset="6"
            class="date-filter-popover"
            :avoid-collisions="true"
            :collision-padding="12"
          >
            <div class="popover-inner">
              <div class="popover-header">
                <span class="popover-title">Выбрать период</span>
              </div>

              <!-- Сводка диапазона -->
              <div class="date-range-summary compact">
                <div class="range-card">
                  <span class="range-card-label">Начало</span>
                  <span class="range-card-value">{{ formatDisplayDate(draftStart) }}</span>
                </div>
                <div class="range-card">
                  <span class="range-card-label">Конец</span>
                  <span class="range-card-value">{{ formatDisplayDate(draftEnd) }}</span>
                </div>
              </div>

              <!-- Быстрые пресеты -->
              <div class="presets-row">
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  type="button"
                  class="preset-pill"
                  :class="{ 'is-active': isPresetActive(preset) }"
                  @click="selectPreset(preset)"
                >
                  {{ preset.label }}
                </button>
              </div>

              <!-- Календарь -->
              <KitCalendarRange
                v-model="draftCalendarModel"
                :min-value="props.minValue"
                :max-value="props.maxValue"
                :initial-focus-date="focusDate"
              />

              <!-- Кнопки действий -->
              <div class="popover-actions">
                <KitBtn
                  variant="text"
                  size="sm"
                  @click="handleReset"
                >
                  Сбросить
                </KitBtn>
                <KitBtn
                  variant="solid"
                  size="sm"
                  @click="handleApply"
                >
                  Применить
                </KitBtn>
              </div>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
    </template>
  </div>
</template>

<style scoped lang="scss">
.finances-date-filter {
  display: inline-flex;
}

.date-filter-btn {
  height: 32px;
  border-radius: var(--r-full);
  transition: all 0.18s ease;

  &.has-active-filter {
    background-color: color-mix(in srgb, var(--fg-accent-color) 12%, var(--bg-secondary-color));
    border-color: color-mix(in srgb, var(--fg-accent-color) 40%, transparent);
    color: var(--fg-accent-color);
    font-weight: 600;
  }
}

.date-filter-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Mobile Sheet Content
.sheet-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px 16px 20px;
}

.date-range-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  &.compact {
    gap: 8px;
    margin-bottom: 2px;
  }
}

.range-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);

  &-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &-value {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.compact .range-card {
  padding: 8px 10px;

  .range-card-value {
    font-size: 0.95rem;
  }
}

// Presets
.presets-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.preset-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  height: 30px;
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.18s ease;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }

  &.is-active {
    background-color: color-mix(in srgb, var(--fg-accent-color) 15%, var(--bg-secondary-color));
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    font-weight: 600;
  }
}

.calendar-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

// Sheet Footer
.sheet-footer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;

  .footer-btn {
    flex: 1;
    height: 44px;
    font-weight: 600;
    font-size: 0.95rem;
    border-radius: var(--r-full);
  }

  .reset-btn {
    flex: 1;
  }

  .apply-btn {
    flex: 1.2;
  }
}

// Desktop Popover
.date-filter-popover {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 1rem;
  z-index: 2005;
  box-shadow: var(--shadow-l);
  animation-duration: 0.2s;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);

  &[data-side='top'] {
    animation-name: slideUpFade;
  }
  &[data-side='bottom'] {
    animation-name: slideDownFade;
  }
}

.popover-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 320px;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.popover-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.popover-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border-secondary-color);
}

@keyframes slideDownFade {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@include media-down(sm) {
  .date-filter-btn {
    width: 100%;
    height: 36px;
    justify-content: center;
  }
}
</style>
