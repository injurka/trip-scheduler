<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import { Icon } from '@iconify/vue'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSlider } from '~/components/01.kit/kit-slider'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { formatDate } from '~/shared/lib/date-time'
import { useAiTripGeneration } from '../../composables/use-ai-trip-generation'

interface WishPreset {
  id: string
  label: string
  icon: string
  text: string
}

const emit = defineEmits<{
  (e: 'created', tripId: string): void
}>()
const visible = defineModel<boolean>('visible', { required: true })

const {
  start,
  reset,
  phase,
  stage,
  logs,
  errorMessage,
  createdTripId,
  progress,
  attempt,
  attemptsTotal,
  stopPolling,
} = useAiTripGeneration()

const country = ref('')
const startDateIso = ref(new Date().toISOString())
const days = ref(7)
const wishes = ref('')
const showCloseConfirm = ref(false)
const logsBoxEl = ref<HTMLElement | null>(null)
const durationQuickOptions = [3, 5, 7, 14]
const wishPresets: WishPreset[] = [
  { id: 'beach', label: 'Море и пляж', icon: 'mdi:beach', text: 'Больше моря, пляжей и отдыха у воды' },
  { id: 'nature', label: 'Природа и горы', icon: 'mdi:image-filter-hdr', text: 'Акцент на природу: горы, треккинг, национальные парки' },
  { id: 'gastro', label: 'Гастрономия', icon: 'mdi:noodles', text: 'Гастрономический акцент: стритфуд, локальная кухня, рынки' },
  { id: 'culture', label: 'История и музеи', icon: 'mdi:bank-outline', text: 'Исторические места, храмы, музеи и культурное наследие' },
  { id: 'workation', label: 'Воркейшн', icon: 'mdi:laptop', text: 'Совместить поездку с удаленной работой: стабильный интернет, рабочее место в отеле, работа во второй половине дня' },
  { id: 'kids', label: 'С детьми', icon: 'mdi:human-male-child', text: 'Путешествие с детьми: спокойный темп, развлечения для ребенка' },
  { id: 'budget', label: 'Бюджетно', icon: 'mdi:wallet-outline', text: 'Экономный вариант: бюджетное жилье, общественный транспорт' },
  { id: 'relaxed', label: 'Спокойный темп', icon: 'mdi:spa-outline', text: 'Спокойный ненасыщенный темп, меньше переездов, время на отдых' },
]

const isFormValid = computed(() => country.value.trim().length >= 2)
const isRunning = computed(() => phase.value === 'generating' || phase.value === 'importing')
const phaseLabel = computed(() => {
  if (phase.value === 'importing')
    return 'Импорт маршрута в расписание…'

  return 'ИИ проектирует ваше путешествие…'
})
const progressPercent = computed(() => {
  if (progress.value === null)
    return null

  return Math.min(100, Math.max(0, progress.value))
})
const progressBarStyle = computed(() => ({
  '--progress-width': `${progressPercent.value ?? 0}%`,
}))
const isProgressIndeterminate = computed(() => progress.value === null)
const activePresetsCount = computed(() => {
  return wishPresets.filter(preset => isPresetActive(preset)).length
})

// Автопрокрутка лога вниз по мере поступления записей
watch(logs, async () => {
  await nextTick()

  if (logsBoxEl.value)
    logsBoxEl.value.scrollTop = logsBoxEl.value.scrollHeight
})
// Сброс подтверждения при повторном открытии родителем
watch(visible, (value) => {
  if (value)
    showCloseConfirm.value = false
})

const toYyyyMmDd = (date: string | Date) => new Date(date).toISOString().split('T')[0]

const startDate = computed({
  get: () => parseDate(toYyyyMmDd(startDateIso.value))!,
  set: (date: CalendarDate | null) => {
    if (date)
      startDateIso.value = date.toDate('UTC').toISOString()
  },
})
const formattedStartDate = computed(() => {
  const selected = startDate.value

  if (!selected)
    return 'Выберите дату'

  const iso = selected.toDate('UTC').toISOString()

  return formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' })
})
const formattedStartWeekday = computed(() => {
  const selected = startDate.value

  if (!selected)
    return ''

  const iso = selected.toDate('UTC').toISOString()

  return formatDate(iso, { weekday: 'short' })
})
const formattedDateRange = computed(() => {
  const selected = startDate.value

  if (!selected)
    return ''

  const end = selected.add({ days: Math.max(0, days.value - 1) })
  const startIso = selected.toDate('UTC').toISOString()
  const endIso = end.toDate('UTC').toISOString()

  const startFormatted = formatDate(startIso, { day: 'numeric', month: 'short' })
  const endFormatted = formatDate(endIso, { day: 'numeric', month: 'short' })

  return startFormatted === endFormatted ? startFormatted : `${startFormatted} — ${endFormatted}`
})

function pluralizeDays(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11)
    return `${count} день`

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${count} дня`

  return `${count} дней`
}
function isPresetActive(preset: WishPreset): boolean {
  return wishes.value.includes(preset.text)
}
function togglePreset(preset: WishPreset) {
  if (isPresetActive(preset)) {
    const parts = wishes.value
      .split(/;\s*/)
      .map(part => part.trim())
      .filter(part => part.length > 0 && part !== preset.text)
    wishes.value = parts.join('; ')
  }
  else {
    const trimmed = wishes.value.trim().replace(/;\s*$/, '')
    wishes.value = trimmed.length > 0 ? `${trimmed}; ${preset.text}` : preset.text
  }
}
function toStartDateString(): string {
  const selected = startDate.value ?? today(getLocalTimeZone())

  return selected.toDate('UTC').toISOString()
}
async function generate() {
  if (!isFormValid.value || isRunning.value)
    return

  showCloseConfirm.value = false
  await start({
    country: country.value.trim(),
    startDate: toStartDateString(),
    days: days.value,
    wishes: wishes.value.trim() || undefined,
  })
}
/**
 * Перехват попытки закрыть модалку. Во время генерации клик вне, Esc или крестик
 * не закрывают диалог — вместо этого показываем подтверждение.
 * Приходится «откатывать» visible обратно в true: DialogClose в KitDialogWithClose
 * пишет в v-model напрямую, и без этого диалог закрылся бы до нашего обработчика.
 */
function onVisibleChange(value: boolean) {
  if (value) {
    showCloseConfirm.value = false

    return
  }

  if (isRunning.value || showCloseConfirm.value) {
    showCloseConfirm.value = true
    visible.value = true

    return
  }

  close()
}
function confirmAbort() {
  stopPolling()
  showCloseConfirm.value = false
  visible.value = false
  setTimeout(reset, 300)
}
function close() {
  if (isRunning.value) {
    showCloseConfirm.value = true

    return
  }

  showCloseConfirm.value = false
  visible.value = false
  setTimeout(reset, 300)
}
function openTrip() {
  if (createdTripId.value) {
    emit('created', createdTripId.value)
    close()
  }
}
</script>

<template>
  <KitDialogWithClose
    v-model:visible="visible"
    title="Путешествие через ИИ"
    description="Опишите направление и предпочтения — ИИ составит детальный план по дням, бюджет и заметки"
    icon="mdi:auto-fix"
    :max-width="540"
    :persistent="isRunning || showCloseConfirm"
    @update:visible="onVisibleChange"
  >
    <div class="ai-trip-flow">
      <template v-if="phase === 'idle' || phase === 'error'">
        <!-- Направление -->
        <KitInput
          v-model="country"
          label="Куда отправимся?"
          icon="mdi:map-marker-radius-outline"
          placeholder="Страна или регион — например, Япония"
          @keydown.enter.prevent="generate"
        >
          <template v-if="country" #append>
            <button
              type="button"
              class="icon-btn"
              aria-label="Очистить направление"
              @click="country = ''"
            >
              <Icon icon="mdi:close-circle" />
            </button>
          </template>
        </KitInput>

        <!-- Даты и длительность -->
        <div class="schedule-card">
          <div class="schedule-row">
            <div class="date-field">
              <span class="field-label">Дата старта</span>
              <CalendarPopover v-model="startDate" :clearable="false">
                <template #trigger>
                  <button type="button" class="date-trigger">
                    <Icon icon="mdi:calendar-month-outline" class="date-trigger-icon" />
                    <span class="date-trigger-value">{{ formattedStartDate }}</span>
                    <span v-if="formattedStartWeekday" class="date-trigger-weekday">
                      {{ formattedStartWeekday }}
                    </span>
                  </button>
                </template>
              </CalendarPopover>
            </div>

            <div class="duration-field">
              <KitSlider
                v-model="days"
                label="Длительность"
                :min="1"
                :max="14"
                :value-formatter="pluralizeDays"
                class="days-slider"
              />
              <div class="duration-presets">
                <button
                  v-for="d in durationQuickOptions"
                  :key="d"
                  type="button"
                  class="duration-pill"
                  :class="{ active: days === d }"
                  @click="days = d"
                >
                  {{ d }} дн.
                </button>
              </div>
            </div>
          </div>

          <div class="schedule-summary">
            <div class="summary-item">
              <Icon icon="mdi:calendar-range" class="summary-icon" />
              <span>Маршрут: <strong>{{ formattedDateRange }}</strong> ({{ pluralizeDays(days) }})</span>
            </div>
          </div>
        </div>

        <!-- Пожелания и акценты -->
        <div class="wishes-section">
          <div class="wishes-header">
            <span class="field-label">Акценты и пожелания</span>
            <span v-if="activePresetsCount > 0" class="presets-badge">
              Выбрано: {{ activePresetsCount }}
            </span>
            <span v-else class="optional-hint">необязательно</span>
          </div>

          <div class="wish-presets" role="group" aria-label="Быстрые акценты поездки">
            <button
              v-for="preset in wishPresets"
              :key="preset.id"
              type="button"
              class="preset-chip"
              :class="{ active: isPresetActive(preset) }"
              :aria-pressed="isPresetActive(preset)"
              @click="togglePreset(preset)"
            >
              <Icon :icon="preset.icon" class="preset-chip-icon" />
              <span>{{ preset.label }}</span>
              <Icon
                v-if="isPresetActive(preset)"
                icon="mdi:check"
                class="preset-chip-check"
              />
            </button>
          </div>

          <KitInput
            v-model="wishes"
            type="textarea"
            placeholder="Дополнительные детали: города мечты, любимая кухня, состав компании, бюджет или особые пожелания…"
          />
        </div>

        <div
          v-if="phase === 'error'"
          class="error-box"
          role="alert"
        >
          <Icon icon="mdi:alert-circle-outline" class="error-box-icon" />
          <div class="error-box-content">
            <strong>Не удалось сгенерировать путешествие</strong>
            <p>{{ errorMessage || 'Произошла непредвиденная ошибка. Попробуйте ещё раз.' }}</p>
          </div>
        </div>

        <div class="flow-actions">
          <KitBtn
            variant="outlined"
            color="secondary"
            @click="close"
          >
            Отмена
          </KitBtn>
          <KitBtn
            :disabled="!isFormValid || isRunning"
            variant="solid"
            color="primary"
            icon="mdi:auto-fix"
            @click="generate"
          >
            Сгенерировать маршрут
          </KitBtn>
        </div>
      </template>

      <template v-else>
        <div class="progress-state">
          <div class="status-visual" :class="{ 'is-done': phase === 'done' }">
            <Icon
              v-if="phase !== 'done'"
              icon="mdi:loading"
              class="spinner-icon"
            />
            <Icon
              v-else
              icon="mdi:check-circle"
              class="success-icon"
            />
          </div>

          <div class="status-headings">
            <p class="phase-label">
              {{ phase === 'done' ? 'Путешествие готово!' : phaseLabel }}
            </p>
            <p
              v-if="stage"
              class="stage-label"
            >
              {{ stage }}
            </p>
            <span
              v-if="phase === 'generating' && attemptsTotal > 1 && attempt > 1"
              class="attempt-badge"
            >
              <Icon icon="mdi:refresh" />
              Попытка {{ attempt }} из {{ attemptsTotal }}
            </span>
          </div>

          <!-- Пошаговый индикатор фаз -->
          <div class="phase-steps">
            <div
              class="phase-step"
              :class="{
                'is-active': phase === 'generating',
                'is-completed': phase === 'importing' || phase === 'done',
              }"
            >
              <span class="phase-step-dot" />
              <span class="phase-step-text">Генерация плана</span>
            </div>
            <div class="phase-step-line" :class="{ 'is-filled': phase === 'importing' || phase === 'done' }" />
            <div
              class="phase-step"
              :class="{
                'is-active': phase === 'importing',
                'is-completed': phase === 'done',
              }"
            >
              <span class="phase-step-dot" />
              <span class="phase-step-text">Импорт заметок</span>
            </div>
            <div class="phase-step-line" :class="{ 'is-filled': phase === 'done' }" />
            <div
              class="phase-step"
              :class="{
                'is-completed': phase === 'done',
              }"
            >
              <span class="phase-step-dot" />
              <span class="phase-step-text">Готово</span>
            </div>
          </div>

          <div
            v-if="phase === 'generating' || phase === 'importing'"
            class="progress-track"
            :class="{ indeterminate: isProgressIndeterminate }"
          >
            <div
              v-if="!isProgressIndeterminate"
              class="progress-bar"
              :style="progressBarStyle"
            />
            <div
              v-else
              class="progress-bar indeterminate-bar"
            />
          </div>

          <div
            v-if="logs.length > 0"
            ref="logsBoxEl"
            class="logs-box"
          >
            <div
              v-for="(log, i) in logs"
              :key="i"
              class="log-line"
            >
              <span class="log-bullet">›</span>
              <span class="log-text">{{ log }}</span>
            </div>
          </div>

          <div
            v-if="phase === 'done'"
            class="flow-actions is-full-width"
          >
            <KitBtn
              variant="outlined"
              color="secondary"
              @click="close"
            >
              Закрыть
            </KitBtn>
            <KitBtn
              variant="solid"
              color="primary"
              icon="mdi:compass-outline"
              @click="openTrip"
            >
              Открыть путешествие
            </KitBtn>
          </div>

          <div
            v-if="showCloseConfirm"
            class="close-confirm"
          >
            <div class="close-confirm-header">
              <Icon icon="mdi:alert-outline" class="close-confirm-icon" />
              <p class="close-confirm-text">
                Генерация всё ещё идёт. Прервать процесс и закрыть окно?
              </p>
            </div>
            <div class="flow-actions">
              <KitBtn
                variant="outlined"
                color="secondary"
                size="sm"
                @click="showCloseConfirm = false"
              >
                Продолжить ожидание
              </KitBtn>
              <KitBtn
                variant="solid"
                color="secondary"
                size="sm"
                icon="mdi:stop-circle-outline"
                @click="confirmAbort"
              >
                Прервать
              </KitBtn>
            </div>
          </div>
        </div>
      </template>
    </div>
  </KitDialogWithClose>
</template>

<style lang="scss" scoped>
.ai-trip-flow {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.schedule-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}

.schedule-row {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 16px;
  align-items: start;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 0.9375rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease;

  @include hover {
    border-color: var(--border-focus-color);
  }

  &-icon {
    font-size: 1.125rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  &-value {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &-weekday {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: var(--r-2xs);
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
  }
}

.duration-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.days-slider {
  width: 100%;
}

.duration-presets {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.duration-pill {
  flex: 1;
  padding: 4px 6px;
  border-radius: var(--r-2xs);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;

  @include hover {
    border-color: var(--border-focus-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background-color: var(--bg-accent-overlay-color);
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    font-weight: 600;
  }
}

.schedule-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px dashed var(--border-secondary-color);
  font-size: 0.8125rem;
  color: var(--fg-secondary-color);

  .summary-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .summary-icon {
    font-size: 1rem;
    color: var(--fg-accent-color);
  }

  strong {
    color: var(--fg-primary-color);
    font-weight: 600;
  }
}

.wishes-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wishes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.optional-hint {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
}

.presets-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background-color: var(--bg-accent-overlay-color);
  color: var(--fg-accent-color);
}

.wish-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;

  &-icon {
    font-size: 1rem;
    color: var(--fg-tertiary-color);
    transition: color 0.2s ease;
  }

  &-check {
    font-size: 0.875rem;
    margin-left: 2px;
  }

  @include hover {
    border-color: var(--border-focus-color);
    color: var(--fg-primary-color);

    .preset-chip-icon {
      color: var(--fg-accent-color);
    }
  }

  &.active {
    background-color: var(--bg-accent-overlay-color);
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);

    .preset-chip-icon {
      color: var(--fg-accent-color);
    }
  }
}

.flow-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);

  &.is-full-width {
    width: 100%;
  }
}

.progress-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 12px 0 4px;
}

.status-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--bg-accent-overlay-color);
  border: 1px solid var(--border-accent-color);

  &.is-done {
    background-color: var(--bg-success-color);
    border-color: var(--border-success-color);
  }

  .spinner-icon {
    width: 34px;
    height: 34px;
    animation: ai-trip-spin 1.1s linear infinite;
    color: var(--fg-accent-color);
  }

  .success-icon {
    width: 36px;
    height: 36px;
    color: var(--fg-success-color);
  }
}

.status-headings {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;

  .phase-label {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .stage-label {
    font-size: 0.875rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .attempt-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    padding: 2px 10px;
    border-radius: var(--r-full);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
  }
}

.phase-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 380px;
  gap: 8px;
}

.phase-step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--fg-tertiary-color);
  white-space: nowrap;

  &-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--border-primary-color);
    transition: all 0.25s ease;
  }

  &.is-active {
    color: var(--fg-accent-color);
    font-weight: 600;

    .phase-step-dot {
      background-color: var(--fg-accent-color);
      box-shadow: 0 0 0 3px var(--bg-accent-overlay-color);
    }
  }

  &.is-completed {
    color: var(--fg-success-color);

    .phase-step-dot {
      background-color: var(--fg-success-color);
    }
  }
}

.phase-step-line {
  flex: 1;
  height: 2px;
  min-width: 16px;
  background-color: var(--border-secondary-color);
  border-radius: var(--r-full);
  transition: background-color 0.3s ease;

  &.is-filled {
    background-color: var(--fg-success-color);
  }
}

.progress-track {
  width: 100%;
  height: 8px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  overflow: hidden;
  position: relative;

  .progress-bar {
    height: 100%;
    width: var(--progress-width, 0%);
    border-radius: var(--r-full);
    background-color: var(--fg-accent-color);
    transition: width 0.3s ease;
  }

  &.indeterminate .indeterminate-bar {
    width: 35%;
    background-color: var(--fg-accent-color);
    animation: ai-trip-load 1.4s ease-in-out infinite;
  }
}

.logs-box {
  width: 100%;
  max-height: 150px;
  overflow-y: auto;
  padding: 10px 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--fg-secondary-color);
  text-align: left;

  .log-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 3px 0;
    line-height: 1.45;

    &:not(:last-child) {
      border-bottom: 1px dashed var(--border-secondary-color);
    }
  }

  .log-bullet {
    color: var(--fg-accent-color);
    font-weight: 700;
    flex-shrink: 0;
  }

  .log-text {
    word-break: break-word;
  }
}

.close-confirm {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--r-s);
  background-color: var(--bg-error-color);
  border: 1px solid var(--border-error-color);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &-icon {
    font-size: 1.25rem;
    color: var(--fg-error-color);
    flex-shrink: 0;
  }

  &-text {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--fg-error-color);
    margin: 0;
  }

  .flow-actions {
    border-top: none;
    padding-top: 0;
  }
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--r-s);
  background-color: var(--bg-error-color);
  border: 1px solid var(--border-error-color);
  color: var(--fg-error-color);
  font-size: 0.8125rem;

  &-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  &-content {
    display: flex;
    flex-direction: column;
    gap: 2px;

    strong {
      font-weight: 600;
    }

    p {
      margin: 0;
      opacity: 0.9;
    }
  }
}

@keyframes ai-trip-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes ai-trip-load {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}
</style>
