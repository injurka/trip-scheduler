<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { vMaska } from 'maska/vue'
import { computed } from 'vue'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  label: string
  icon?: string
  readonly: boolean
  placeholder?: string
  type?: 'date' | 'datetime'
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  placeholder: '...',
  type: 'date',
})

const modelValue = defineModel<string | undefined>()

// --- MASK & PLACEHOLDER ---
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

// --- VALUE FORMATTING ---

/**
 * Helper function to format a Date object into 'DD.MM.YYYY HH:MM' or 'DD.MM.YYYY'
 */
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

/**
 * Helper function to parse 'DD.MM.YYYY HH:MM' or 'DD.MM.YYYY' into a Date object.
 * Returns null if the format is invalid.
 */
function parseDisplayDate(dateString: string, type: 'date' | 'datetime'): Date | null {
  if (!dateString)
    return null

  if (type === 'datetime') {
    const parts = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2})$/)
    if (!parts)
      return null
    const [, day, month, year, hours, minutes] = parts
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes))
    // Check for invalid dates that Date constructor might create (e.g., month 13)
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day))
      return null

    return date
  }
  else {
    const parts = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (!parts)
      return null
    const [, day, month, year] = parts
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day))
      return null

    return date
  }
}

/**
 * Computed property to bridge the ISO string (modelValue) and the display format (DD.MM.YYYY HH:MM).
 */
const displayValue = computed({
  get() {
    if (!modelValue.value)
      return ''
    const date = new Date(modelValue.value)
    if (Number.isNaN(date.getTime()))
      return '' // Invalid date in modelValue
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
        // For date-only, we can just use the date part or a zeroed time
        isoString += `T00:00:00`
      }
      modelValue.value = isoString
    }
    else if (!newValue) {
      // Allow clearing the field
      modelValue.value = undefined
    }
  },
})

/**
 * Formats value for readonly display.
 */
const formattedValue = computed(() => {
  if (!modelValue.value)
    return props.placeholder

  const date = new Date(modelValue.value)

  if (Number.isNaN(date.getTime()))
    return modelValue.value

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }

  if (props.type === 'datetime') {
    options.hour = '2-digit'
    options.minute = '2-digit'
  }

  return new Intl.DateTimeFormat('ru-RU', options).format(date)
})
</script>

<template>
  <div class="booking-field">
    <!-- Readonly View -->
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

    <!-- Editable View -->
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
}

.field-label {
  font-size: 0.75rem;
  margin-left: 2px;
  color: var(--fg-tertiary-color);
  font-weight: 500;
}

.readonly-content {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  box-sizing: border-box;
  padding: 6px 2px;
}

.field-icon {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.readonly-value {
  color: var(--fg-primary-color);
  line-height: 1.4;
  font-size: 0.9rem;
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
