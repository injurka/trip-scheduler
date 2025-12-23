<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import { Icon } from '@iconify/vue'
import { getLocalTimeZone, parseDate, Time, today } from '@internationalized/date'
import { useDateFormat } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'

interface Props {
  initialCoords: [number, number] | null
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const emit = defineEmits<{
  (e: 'create', data: any): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

// State
const title = ref('')
const description = ref('')
const selectedDate = shallowRef<CalendarDate>(today(getLocalTimeZone()))
const startTime = shallowRef<Time>(new Time(9, 0))
const endTime = shallowRef<Time>(new Time(10, 0))

const formattedDate = computed(() => {
  const date = selectedDate.value.toDate(getLocalTimeZone())
  return useDateFormat(date, 'D MMMM YYYY', { locales: 'ru-RU' }).value
})

function getIsoDateTime(date: CalendarDate, time: Time): string {
  const d = date.toDate(getLocalTimeZone())
  d.setHours(time.hour, time.minute, 0, 0)
  // Корректируем смещение, чтобы получить ISO в локальном времени или UTC
  // В данном случае формируем ISO строку с учетом таймзоны
  const offset = d.getTimezoneOffset()
  const localTime = new Date(d.getTime() - offset * 60 * 1000)
  return localTime.toISOString()
}

function handleSave() {
  if (props.isLoading)
    return

  if (!title.value.trim()) {
    // Можно добавить валидацию
    return
  }

  const startIso = getIsoDateTime(selectedDate.value, startTime.value)
  const endIso = getIsoDateTime(selectedDate.value, endTime.value)

  if (new Date(endIso) <= new Date(startIso)) {
    // Простая валидация: если конец раньше начала
    // Можно добавить toast.error('Время окончания должно быть позже начала')
    return
  }

  const payload = {
    title: title.value,
    description: description.value,
    startAt: startIso,
    endAt: endIso,
    coords: props.initialCoords,
  }

  emit('create', payload)
}

function handleUpdateVisible(value: boolean) {
  if (props.isLoading && !value)
    return

  visible.value = value
}

// Сброс формы при открытии
watch(
  () => visible.value,
  (isOpen) => {
    if (isOpen) {
      const now = new Date()
      title.value = ''
      description.value = ''

      // Устанавливаем текущую дату
      selectedDate.value = parseDate(now.toISOString().split('T')[0])

      // Устанавливаем текущее время и +1 час
      startTime.value = new Time(now.getHours(), now.getMinutes())
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
      endTime.value = new Time(oneHourLater.getHours(), oneHourLater.getMinutes())
    }
  },
)
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Новая активность"
    icon="mdi:map-marker-plus"
    :max-width="500"
    @update:visible="handleUpdateVisible"
  >
    <div class="form-content" :class="{ 'is-loading': isLoading }">
      <KitInput
        v-model="title"
        label="Название"
        placeholder="Например: Обед"
        required
        :disabled="isLoading"
      />

      <div class="date-time-row">
        <div class="field-group date-group">
          <label class="field-label">Дата</label>
          <CalendarPopover v-model="selectedDate" :clearable="false">
            <template #trigger>
              <button class="date-trigger" type="button">
                <Icon icon="mdi:calendar-blank-outline" />
                <span>{{ formattedDate }}</span>
              </button>
            </template>
          </CalendarPopover>
        </div>

        <div class="field-group time-group">
          <label class="field-label">Начало</label>
          <div class="time-input-wrapper">
            <KitTimeField v-model="startTime" :disabled="isLoading" />
          </div>
        </div>

        <div class="field-group time-group">
          <label class="field-label">Конец</label>
          <div class="time-input-wrapper">
            <KitTimeField v-model="endTime" :disabled="isLoading" />
          </div>
        </div>
      </div>

      <KitInput
        v-model="description"
        type="textarea"
        label="Описание"
        placeholder="Подробности..."
        :disabled="isLoading"
      />

      <div class="form-actions">
        <KitBtn
          variant="text"
          :disabled="isLoading"
          @click="handleUpdateVisible(false)"
        >
          Отмена
        </KitBtn>
        <KitBtn
          :disabled="isLoading || !title.trim()"
          :loading="isLoading"
          @click="handleSave"
        >
          <template v-if="isLoading">
            Сохранение...
          </template>
          <template v-else>
            Сохранить
          </template>
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.form-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 8px;
  transition: opacity 0.2s;
}

.form-content.is-loading {
  opacity: 0.8;
  pointer-events: none;
}

.date-time-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.date-group {
  flex: 1;
}

.time-group {
  width: 80px;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  margin-left: 2px;
}

.date-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 46px; /* Высота md инпута */
  padding: 0 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-focus-color);
  }

  .iconify {
    color: var(--fg-tertiary-color);
    font-size: 1.2rem;
  }
}

.time-input-wrapper {
  :deep(.kit-time-field) {
    height: 46px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    justify-content: center;

    &:focus-within {
      border-color: var(--border-focus-color);
    }
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
