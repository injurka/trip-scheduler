<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { Category, Transaction } from '../../models/types'
import { Icon } from '@iconify/vue'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { onClickOutside, useDateFormat } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendar } from '~/components/01.kit/kit-calendar'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'

interface Props {
  visible: boolean
  transaction: Transaction | null
  categories: Category[]
  mainCurrency: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', transaction: Partial<Transaction>): void
  (e: 'openCategoryManager'): void
}>()

const form = ref<Partial<Transaction>>({})
const isTimeless = ref(false)

// --- Date Picker Logic ---
const isCalendarOpen = ref(false)
const datePickerWrapperRef = ref(null)
onClickOutside(datePickerWrapperRef, () => {
  isCalendarOpen.value = false
})

const formattedDate = computed(() => {
  if (!form.value.date)
    return 'Выберите дату'

  const [year, month, day] = form.value.date.split('-').map(Number)
  const dateObj = new Date(Date.UTC(year, month - 1, day))
  return useDateFormat(dateObj, 'D MMMM YYYY г.', { locales: 'ru-RU' }).value
})

const calendarDate = computed<CalendarDate>({
  get() {
    try {
      if (form.value.date)
        return parseDate(form.value.date)
    }
    catch {
      console.error('Invalid date format:', form.value.date)
    }
    return today(getLocalTimeZone())
  },
  set(newDate: CalendarDate | null) {
    if (newDate)
      form.value.date = newDate.toString()
    isCalendarOpen.value = false
  },
})

// --- General Form Logic ---
const title = computed(() => props.transaction ? 'Редактировать трату' : 'Новая трата')

const categoryItems = computed(() =>
  props.categories.map(c => ({ value: c.id, label: c.name, icon: c.icon })),
)

function handleSubmit() {
  const payload = { ...form.value }
  if (isTimeless.value)
    delete payload.date

  emit('save', payload)
}

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    isCalendarOpen.value = false
    form.value = props.transaction
      ? { ...props.transaction }
      : {
          date: today(getLocalTimeZone()).toString(),
          currency: props.mainCurrency,
          categoryId: null,
          title: '',
          amount: 0,
          notes: '',
        }
    isTimeless.value = !form.value.date
  }
})

watch(isTimeless, (isNowTimeless) => {
  if (!isNowTimeless && !form.value.date)
    form.value.date = today(getLocalTimeZone()).toString()
})
</script>

<template>
  <KitDialogWithClose :visible="visible" :title="title" icon="mdi:cash-plus" @update:visible="emit('update:visible', $event)">
    <form v-if="form" class="form-grid" @submit.prevent="handleSubmit">
      <KitInput v-model="form.title" label="Название" placeholder="Обед в ресторане" required class="span-2" />

      <KitInput v-model.number="form.amount" label="Сумма" type="number" required />
      <KitInput v-model="form.currency" label="Валюта" placeholder="RUB, USD..." />

      <div class="span-2">
        <KitCheckbox v-model="isTimeless">
          Общая трата (без привязки к дате)
        </KitCheckbox>
      </div>

      <div class="category-select-wrapper span-2">
        <KitSelectWithSearch
          v-model="form.categoryId!"
          :items="categoryItems"
          label="Категория"
          placeholder="Выберите категорию"
        />
        <KitBtn
          icon="mdi:cog-outline"
          variant="text"
          title="Управлять категориями"
          class="manage-categories-btn"
          @click="$emit('openCategoryManager')"
        />
      </div>

      <div v-if="!isTimeless" ref="datePickerWrapperRef" class="date-picker-wrapper span-2">
        <label class="kit-input__label">Дата</label>
        <button type="button" class="date-input" @click="isCalendarOpen = !isCalendarOpen">
          <span>{{ formattedDate }}</span>
          <Icon icon="mdi:calendar-blank-outline" />
        </button>
        <KitCalendar
          v-if="isCalendarOpen"
          v-model="calendarDate"
          class="calendar-popover"
        />
      </div>

      <div class="note-wrapper span-2">
        <KitInput
          v-model="form.notes"
          type="textarea"
          label="Заметки"
          placeholder="Дополнительная информация"
          :rows="4"
          class="span-2"
        />
      </div>

      <div class="form-actions span-2">
        <KitBtn variant="text" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn type="submit">
          Сохранить
        </KitBtn>
      </div>
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.span-2 {
  grid-column: span 2;
}

.date-picker-wrapper {
  position: relative;
  // Borrow label styles from KitInput for consistency
  .kit-input__label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.date-input {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  text-align: left;
  font-size: 1rem;
  color: var(--fg-primary-color);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-secondary-color);
  }

  svg {
    color: var(--fg-tertiary-color);
  }
}

.calendar-popover {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  z-index: 100;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}
.category-select-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  .kit-select-with-search {
    flex-grow: 1;
  }
  .manage-categories-btn {
    height: 44px;
    width: 44px;
    flex-shrink: 0;
  }
}
</style>
