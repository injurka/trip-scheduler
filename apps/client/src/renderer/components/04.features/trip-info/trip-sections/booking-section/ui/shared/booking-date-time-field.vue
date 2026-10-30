<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { vMaska } from 'maska/vue'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  label: string
  icon?: string
  readonly: boolean
  placeholder?: string
  type?: 'date' | 'datetime'
  showYear?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  placeholder: '...',
  type: 'date',
  showYear: false,
})
const modelValue = defineModel<string | undefined>()

const mask = computed(() => {
  if (props.type === 'datetime')
    return '##.##.#### ##:##'

  return '##.##.####'
})
const effectivePlaceholder = computed(() => {
  if (props.placeholder !== '...')
    return props.placeholder

  if (props.type === 'datetime')
    return 'ДД.ММ.ГГГГ ЧЧ:ММ'

  return 'ДД.ММ.ГГГГ'
})
const displayValue = computed({
  get() {
    if (!modelValue.value)
      return ''

    const date = new Date(modelValue.value)

    if (Number.isNaN(date.getTime()))
      return ''

    return formatDateToDisplay(date, props.type)
  },
  set(newValue) {
    const parsedDate = parseDisplayDate(newValue, props.type)

    if (parsedDate) {
      const year = parsedDate.getFullYear()
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
      const day = String(parsedDate.getDate()).padStart(2, '0')

      let isoString = `${year}-${month}-${day}`

      if (props.type === 'datetime') {
        const hours = String(parsedDate.getHours()).padStart(2, '0')
        const minutes = String(parsedDate.getMinutes()).padStart(2, '0')
        isoString += `T${hours}:${minutes}:00`
      }
      else {
        isoString += `T00:00:00`
      }

      modelValue.value = isoString
    }
    else if (!newValue) {
      modelValue.value = undefined
    }
  },
})
const formattedValue = computed(() => {
  if (!modelValue.value)
    return props.placeholder

  const date = new Date(modelValue.value)

  if (Number.isNaN(date.getTime()))
    return modelValue.value

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
  }

  if (props.showYear)
    options.year = 'numeric'

  if (props.type === 'datetime') {
    options.hour = '2-digit'
    options.minute = '2-digit'
  }

  return new Intl.DateTimeFormat('ru-RU', options).format(date)
})

function formatDateToDisplay(date: Date, type: 'date' | 'datetime'): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  if (type === 'datetime') {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${day}.${month}.${year} ${hours}:${minutes}`
  }

  return `${day}.${month}.${year}`
}
function parseDisplayDate(dateString: string, type: 'date' | 'datetime'): Date | null {
  if (!dateString)
    return null

  return type === 'datetime' ? parseDisplayDateTime(dateString) : parseDisplayDay(dateString)
}

function parseDisplayDateTime(value: string): Date | null {
  const parts = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})$/)

  if (!parts)
    return null

  const [, day, month, year, hours, minutes] = parts

  return createValidDate(
    year,
    month,
    day,
    hours,
    minutes,
  )
}

function parseDisplayDay(value: string): Date | null {
  const parts = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)

  if (!parts)
    return null

  const [, day, month, year] = parts

  return createValidDate(year, month, day)
}

function createValidDate(
  year: string,
  month: string,
  day: string,
  hours = '0',
  minutes = '0',
): Date | null {
  const numericYear = Number(year)
  const numericMonth = Number(month) - 1
  const numericDay = Number(day)
  const numericHours = Number(hours)
  const numericMinutes = Number(minutes)
  const date = new Date(
    numericYear,
    numericMonth,
    numericDay,
    numericHours,
    numericMinutes,
  )

  if (date.getFullYear() !== numericYear || date.getMonth() !== numericMonth || date.getDate() !== numericDay)
    return null

  return date
}
</script>

<template>
  <div class="booking-field">
    <div v-if="props.readonly" class="readonly-wrapper">
      <label class="field-label">
        {{ label }}
      </label>
      <div class="readonly-content">
        <Icon v-if="icon" :icon="icon" class="field-icon" />
        <span :class="modelValue ? 'readonly-value' : 'readonly-placeholder'">
          {{ formattedValue }}
        </span>
      </div>
    </div>

    <KitInput
      v-else
      v-model="displayValue"
      v-maska
      :data-maska="mask"
      :label="label"
      :icon="icon"
      :placeholder="effectivePlaceholder"
      :disabled="readonly"
      size="sm"
    />
  </div>
</template>

<style scoped lang="scss">
.readonly-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-block: 2px;
}

.field-label {
  font-size: 0.725rem;
  margin-left: 2px;
  color: var(--fg-tertiary-color);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1.2;
}

.readonly-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  box-sizing: border-box;
  padding: 4px 10px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
}

.field-icon {
  font-size: 1rem;
  color: var(--booking-icon-color, var(--fg-accent-color));
  flex-shrink: 0;
}

.booking-field:deep(.input-icon-prefix) {
  color: var(--booking-icon-color, var(--fg-tertiary-color));
}

.readonly-value {
  color: var(--fg-primary-color);
  line-height: 1.4;
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.readonly-placeholder {
  color: var(--fg-tertiary-color);
}

.booking-field:deep(.kit-input-group) {
  gap: 2px;
}
.booking-field:deep(label) {
  font-size: 0.75rem;
  margin-left: 2px;
}
.booking-field:deep(input) {
  height: 36px;
  background-color: var(--bg-tertiary-color);
  &:focus {
    background-color: var(--bg-primary-color);
  }
}
</style>
