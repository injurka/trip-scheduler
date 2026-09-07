<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import { Icon } from '@iconify/vue'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSlider } from '~/components/01.kit/kit-slider'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { useAiTripGeneration } from '../../composables/use-ai-trip-generation'

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
  stopPolling,
} = useAiTripGeneration()

const country = ref('')
const startDateIso = ref(new Date().toISOString())
const days = ref(7)
const wishes = ref('')

const toYyyyMmDd = (date: string | Date) => new Date(date).toISOString().split('T')[0]

const startDate = computed({
  get: () => parseDate(toYyyyMmDd(startDateIso.value))!,
  set: (date: CalendarDate | null) => {
    if (date)
      startDateIso.value = date.toDate('UTC').toISOString()
  },
})

const wishPresets = [
  { label: '🏖️ Море и пляж', text: 'Больше моря, пляжей и отдыха у воды' },
  { label: '⛰️ Природа и горы', text: 'Акцент на природу: горы, треккинг, национальные парки' },
  { label: '🍜 Гастрономия', text: 'Гастрономический акцент: стритфуд, локальная кухня, рынки' },
  { label: '🏛️ История и музеи', text: 'Исторические места, храмы, музеи и культурное наследие' },
  { label: '💻 Воркейшн', text: 'Совместить поездку с удаленной работой: стабильный интернет, рабочее место в отеле, работа во второй половине дня' },
  { label: '🧒 С детьми', text: 'Путешествие с детьми: спокойный темп, развлечения для ребенка' },
  { label: '💸 Бюджетно', text: 'Экономный вариант: бюджетное жилье, общественный транспорт' },
  { label: '🧘 Спокойный темп', text: 'Спокойный ненасыщенный темп, меньше переездов, время на отдых' },
]

const activePresets = ref<Set<string>>(new Set())

function togglePreset(preset: { label: string, text: string }) {
  if (activePresets.value.has(preset.label)) {
    activePresets.value.delete(preset.label)
    wishes.value = wishes.value
      .split('; ')
      .filter(part => part !== preset.text)
      .join('; ')
  }
  else {
    activePresets.value.add(preset.label)
    wishes.value = wishes.value.trim().length > 0
      ? `${wishes.value.trim().replace(/;$/, '')}; ${preset.text}`
      : preset.text
  }
}

function isPresetActive(label: string): boolean {
  return activePresets.value.has(label)
}

const isFormValid = computed(() => country.value.trim().length >= 2)

const isRunning = computed(() => phase.value === 'generating' || phase.value === 'importing')

const phaseLabel = computed(() => {
  if (phase.value === 'importing')
    return 'Импорт сгенерированных заметок в путешествие…'
  return 'ИИ генерирует заметки путешествия…'
})

function toStartDateString(): string {
  const selected = startDate.value ?? today(getLocalTimeZone())
  return selected.toDate('UTC').toISOString()
}

async function generate() {
  await start({
    country: country.value.trim(),
    startDate: toStartDateString(),
    days: days.value,
    wishes: wishes.value.trim() || undefined,
  })
}

function close() {
  if (isRunning.value)
    stopPolling()
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
    icon="mdi:auto-fix"
    :max-width="500"
    @update:visible="val => !val && close()"
  >
    <div class="ai-trip-flow">
      <template v-if="phase === 'idle' || phase === 'error'">
        <KitInput
          v-model="country"
          label="Страна"
          placeholder="Например, Япония"
        />
        <div class="date-and-days">
          <div class="date-picker">
            <label>Дата начала</label>
            <CalendarPopover v-model="startDate">
              <template #trigger>
                <button class="date-trigger">
                  {{ startDate?.toString() }}
                </button>
              </template>
            </CalendarPopover>
          </div>
          <KitSlider
            v-model="days"
            label="Длительность"
            :min="1"
            :max="15"
            class="days-slider"
          />
        </div>

        <KitInput
          v-model="wishes"
          type="textarea"
          label="Пожелания (необязательно)"
          placeholder="Что хотите увидеть, любимая еда, темп поездки, воркейшн и т.д."
        />

        <div class="wish-presets">
          <button
            v-for="preset in wishPresets"
            :key="preset.label"
            type="button"
            class="preset-chip"
            :class="{ active: isPresetActive(preset.label) }"
            @click="togglePreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div
          v-if="phase === 'error'"
          class="error-box"
        >
          {{ errorMessage || 'Произошла ошибка.' }}
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
            :disabled="!isFormValid"
            :loading="isRunning"
            variant="tonal"
            prepend-icon="mdi:auto-fix"
            @click="generate"
          >
            Сгенерировать
          </KitBtn>
        </div>
      </template>

      <template v-else>
        <div class="progress-state">
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
          <p class="phase-label">
            {{ phase === 'done' ? 'Путешествие создано!' : phaseLabel }}
          </p>
          <p
            v-if="stage"
            class="stage-label"
          >
            {{ stage }}
          </p>

          <div
            v-if="logs.length > 0"
            class="logs-box"
          >
            <div
              v-for="(log, i) in logs.slice(-8)"
              :key="i"
              class="log-line"
            >
              {{ log }}
            </div>
          </div>

          <div
            v-if="phase === 'done'"
            class="flow-actions"
          >
            <KitBtn
              variant="outlined"
              color="secondary"
              @click="close"
            >
              Закрыть
            </KitBtn>
            <KitBtn
              variant="tonal"
              prepend-icon="mdi:compass-outline"
              @click="openTrip"
            >
              Открыть путешествие
            </KitBtn>
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

.date-and-days {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.date-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.days-slider {
  flex: 1;
}

.date-trigger {
  width: 100%;
  padding: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-focus-color);
  }
}

.wish-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-chip {
  padding: 6px 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 999px;
  font-size: 0.8125rem;
  color: var(--fg-primary-color);
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;

  &:hover {
    border-color: var(--border-focus-color);
  }

  &.active {
    background-color: var(--bg-accent-color, var(--bg-secondary-color));
    border-color: var(--border-focus-color);
    color: var(--fg-accent-color, var(--fg-primary-color));
  }
}

.flow-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
}

.progress-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px 0;

  .spinner-icon {
    width: 42px;
    height: 42px;
    animation: ai-trip-spin 1.2s linear infinite;
    color: var(--fg-accent-color, var(--fg-primary-color));
  }

  .success-icon {
    width: 42px;
    height: 42px;
    color: var(--fg-success-color, #3fae6a);
  }

  .phase-label {
    font-weight: 600;
    text-align: center;
  }

  .stage-label {
    font-size: 0.875rem;
    color: var(--fg-secondary-color);
    text-align: center;
  }
}

.logs-box {
  width: 100%;
  max-height: 140px;
  overflow-y: auto;
  padding: 10px 12px;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-s);
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--fg-secondary-color);

  .log-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.error-box {
  padding: 10px 12px;
  border-radius: var(--r-s);
  background-color: var(--bg-error-color);
  color: var(--fg-error-color);
  font-size: 0.875rem;
}

@keyframes ai-trip-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
