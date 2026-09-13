<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { Category, Transaction } from '../../models/types'
import { Icon } from '@iconify/vue'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { onClickOutside, useDateFormat } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendar } from '~/components/01.kit/kit-calendar'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { useCurrencyFormatter } from '../../composables/use-currency-formatter'

interface Props {
  visible: boolean
  transaction: Transaction | null
  categories: Category[]
  mainCurrency: string
  exchangeRates?: Record<string, number>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', transaction: Partial<Transaction>): void
  (e: 'openCategoryManager'): void
}>()

const form = ref<Partial<Transaction>>({})
const isTimeless = ref(false)

// Formatting
const { format: formatCurrency } = useCurrencyFormatter()

// Title
const title = computed(() => props.transaction ? 'Редактировать расход' : 'Новый расход')

// Currencies
const isCurrencyPickerOpen = ref(false)
const currencyPickerRef = ref<HTMLElement | null>(null)
const currencySearchQuery = ref('')

onClickOutside(currencyPickerRef, () => {
  isCurrencyPickerOpen.value = false
})

const tripCurrencies = computed(() => {
  const set = new Set<string>()
  if (props.mainCurrency)
    set.add(props.mainCurrency.toUpperCase())
  if (props.exchangeRates) {
    for (const code of Object.keys(props.exchangeRates)) {
      const upper = code.trim().toUpperCase()
      if (upper)
        set.add(upper)
    }
  }
  return Array.from(set)
})

const popularCurrencies = ['USD', 'EUR', 'RUB', 'CNY', 'JPY', 'TRY', 'GEL', 'AED', 'THB', 'KZT', 'GBP']

const filteredCurrencies = computed(() => {
  const query = currencySearchQuery.value.trim().toUpperCase()
  const base = popularCurrencies.filter(c => !tripCurrencies.value.includes(c))
  if (!query)
    return base
  return base.filter(c => c.includes(query))
})

function selectCurrency(code: string) {
  form.value.currency = code.toUpperCase()
  isCurrencyPickerOpen.value = false
  currencySearchQuery.value = ''
}

function applyCustomCurrency(val: string) {
  const cleaned = val.trim().toUpperCase().slice(0, 3)
  if (cleaned.length === 3) {
    selectCurrency(cleaned)
  }
}

// Live Conversion Preview
const conversionPreview = computed(() => {
  const amt = Number(form.value.amount)
  if (!amt || amt <= 0)
    return null

  const curr = (form.value.currency || props.mainCurrency || '').toUpperCase()
  const main = (props.mainCurrency || '').toUpperCase()

  if (!curr || !main || curr === main)
    return null

  const rates = props.exchangeRates || {}
  const rate = rates[curr]

  if (rate && rate > 0) {
    const totalInMain = amt * rate
    return {
      convertedText: `≈ ${formatCurrency(totalInMain, main)}`,
      rateText: `1 ${curr} = ${rate} ${main}`,
    }
  }

  return {
    convertedText: null,
    rateText: `Курс для ${curr} не указан в настройках бюджета`,
  }
})

// Categories
const categoryItems = computed(() =>
  props.categories.map(c => ({ value: c.id, label: c.name, icon: c.icon })),
)

const quickCategories = computed(() => {
  return props.categories.slice(0, 4)
})

// Date & Calendar
const isCalendarOpen = ref(false)
const datePickerWrapperRef = ref<HTMLElement | null>(null)

onClickOutside(datePickerWrapperRef, () => {
  isCalendarOpen.value = false
})

const todayStr = computed(() => today(getLocalTimeZone()).toString())
const yesterdayStr = computed(() => today(getLocalTimeZone()).subtract({ days: 1 }).toString())

function isTodayDate(d?: string) {
  return d === todayStr.value
}

function isYesterdayDate(d?: string) {
  return d === yesterdayStr.value
}

function setToday() {
  isTimeless.value = false
  form.value.date = todayStr.value
  isCalendarOpen.value = false
}

function setYesterday() {
  isTimeless.value = false
  form.value.date = yesterdayStr.value
  isCalendarOpen.value = false
}

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

// Validation
const isSaveDisabled = computed(() => {
  const hasTitle = Boolean(form.value.title?.trim())
  const hasAmount = form.value.amount !== null && form.value.amount !== undefined && Number(form.value.amount) >= 0
  return !hasTitle || !hasAmount
})

function handleSubmit() {
  if (isSaveDisabled.value)
    return

  const payload = { ...form.value }
  payload.amount = Number(payload.amount) || 0
  payload.currency = (payload.currency || props.mainCurrency || 'RUB').toUpperCase()

  if (isTimeless.value)
    delete payload.date

  emit('save', payload)
}

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    isCalendarOpen.value = false
    isCurrencyPickerOpen.value = false
    currencySearchQuery.value = ''

    form.value = props.transaction
      ? { ...props.transaction }
      : {
          date: todayStr.value,
          currency: props.mainCurrency || 'RUB',
          categoryId: null,
          title: '',
          amount: '' as unknown as number,
          notes: '',
          isSpontaneous: false,
          status: 'paid',
        }
    isTimeless.value = !form.value.date
  }
})

watch(isTimeless, (isNowTimeless) => {
  if (!isNowTimeless && !form.value.date)
    form.value.date = todayStr.value
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="title"
    :max-width="540"
    icon="mdi:cash-fast"
    @update:visible="emit('update:visible', $event)"
  >
    <form v-if="form" class="transaction-form" @submit.prevent="handleSubmit">
      <!-- 1. Status Segmented Switcher -->
      <div class="status-segmented-control">
        <button
          type="button"
          class="status-tab-btn"
          :class="{ active: (form.status || 'paid') === 'paid' }"
          @click="form.status = 'paid'"
        >
          <Icon icon="mdi:check-circle" class="tab-icon success" />
          <span class="tab-label">Оплачено</span>
        </button>

        <button
          type="button"
          class="status-tab-btn"
          :class="{ active: form.status === 'planned' }"
          @click="form.status = 'planned'"
        >
          <Icon icon="mdi:clock-outline" class="tab-icon planned" />
          <span class="tab-label">В планах</span>
        </button>
      </div>

      <!-- 2. Hero Amount & Currency Card -->
      <div class="hero-amount-card">
        <div class="hero-top-row">
          <label class="hero-field-label">Сумма расхода</label>
          <div v-if="conversionPreview?.convertedText" class="conversion-badge" :title="conversionPreview.rateText">
            <Icon icon="mdi:swap-horizontal" class="swap-icon" />
            <span>{{ conversionPreview.convertedText }}</span>
          </div>
        </div>

        <div class="hero-input-row">
          <div class="hero-amount-input-box">
            <input
              v-model.number="form.amount"
              type="number"
              step="any"
              min="0"
              placeholder="0"
              required
              class="hero-amount-input"
              @focus="($event.target as HTMLInputElement).select()"
            >
          </div>

          <!-- Currency Trigger & Dropdown -->
          <div ref="currencyPickerRef" class="currency-picker-wrap">
            <button
              type="button"
              class="currency-trigger-btn"
              :class="{ 'is-active': isCurrencyPickerOpen }"
              @click="isCurrencyPickerOpen = !isCurrencyPickerOpen"
            >
              <span class="curr-value">{{ form.currency || mainCurrency }}</span>
              <Icon icon="mdi:chevron-down" class="chevron" />
            </button>

            <!-- Dropdown Popover -->
            <div v-if="isCurrencyPickerOpen" class="currency-popover">
              <div class="currency-search-bar">
                <Icon icon="mdi:magnify" class="search-ico" />
                <input
                  v-model="currencySearchQuery"
                  type="text"
                  maxlength="3"
                  placeholder="Валюта (3 буквы)..."
                  class="search-input"
                  @keydown.enter.prevent="applyCustomCurrency(currencySearchQuery)"
                >
                <button
                  v-if="currencySearchQuery.trim().length === 3"
                  type="button"
                  class="apply-code-btn"
                  title="Выбрать"
                  @click="applyCustomCurrency(currencySearchQuery)"
                >
                  <Icon icon="mdi:check" />
                </button>
              </div>

              <div v-if="tripCurrencies.length > 0" class="curr-section">
                <span class="curr-section-title">В этой поездке</span>
                <div class="curr-chips-list">
                  <button
                    v-for="code in tripCurrencies"
                    :key="code"
                    type="button"
                    class="curr-chip-btn"
                    :class="{ selected: (form.currency || mainCurrency) === code }"
                    @click="selectCurrency(code)"
                  >
                    {{ code }}
                  </button>
                </div>
              </div>

              <div v-if="filteredCurrencies.length > 0" class="curr-section">
                <span class="curr-section-title">Популярные</span>
                <div class="curr-chips-list">
                  <button
                    v-for="code in filteredCurrencies"
                    :key="code"
                    type="button"
                    class="curr-chip-btn"
                    :class="{ selected: (form.currency || mainCurrency) === code }"
                    @click="selectCurrency(code)"
                  >
                    {{ code }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="conversionPreview?.rateText" class="hero-rate-footnote">
          <Icon icon="mdi:information-outline" class="rate-icon" />
          <span>{{ conversionPreview.rateText }}</span>
        </div>
      </div>

      <!-- 3. Title -->
      <div class="form-row">
        <KitInput
          v-model="form.title"
          label="Название"
          placeholder="Обед в ресторане, билеты на поезд, отель..."
          required
          icon="mdi:tag-outline"
        />
      </div>

      <!-- 4. Category -->
      <div class="form-row category-group">
        <div class="category-header-row">
          <label class="field-label">Категория</label>
          <KitBtn
            icon="mdi:cog-outline"
            variant="text"
            size="sm"
            class="manage-categories-link"
            title="Управлять категориями"
            @click="$emit('openCategoryManager')"
          >
            Настроить
          </KitBtn>
        </div>

        <!-- Quick Category Chips -->
        <div v-if="quickCategories.length > 0" class="quick-category-chips">
          <button
            v-for="cat in quickCategories"
            :key="cat.id"
            type="button"
            class="quick-category-btn"
            :class="{ active: form.categoryId === cat.id }"
            @click="form.categoryId = cat.id"
          >
            <Icon v-if="cat.icon" :icon="cat.icon" class="cat-chip-icon" />
            <span>{{ cat.name }}</span>
          </button>
        </div>

        <KitSelectWithSearch
          v-model="form.categoryId!"
          :items="categoryItems"
          placeholder="Выберите или найдите категорию..."
        />
      </div>

      <!-- 5. Date & Timeless Mode -->
      <div class="form-row date-group">
        <div class="date-header-row">
          <label class="field-label">Дата расхода</label>
          <button
            type="button"
            class="timeless-toggle"
            :class="{ active: isTimeless }"
            @click="isTimeless = !isTimeless"
          >
            <Icon :icon="isTimeless ? 'mdi:check-circle' : 'mdi:checkbox-blank-circle-outline'" class="check-ico" />
            <span>Без привязки к дате (общая)</span>
          </button>
        </div>

        <div v-if="!isTimeless" ref="datePickerWrapperRef" class="date-picker-box">
          <div class="date-controls-row">
            <div class="quick-date-chips">
              <button
                type="button"
                class="date-chip-btn"
                :class="{ active: isTodayDate(form.date) }"
                @click="setToday"
              >
                Сегодня
              </button>
              <button
                type="button"
                class="date-chip-btn"
                :class="{ active: isYesterdayDate(form.date) }"
                @click="setYesterday"
              >
                Вчера
              </button>
            </div>

            <button
              type="button"
              class="date-picker-trigger"
              :class="{ 'is-open': isCalendarOpen }"
              @click="isCalendarOpen = !isCalendarOpen"
            >
              <Icon icon="mdi:calendar-blank-outline" class="cal-ico" />
              <span class="date-label-text">{{ formattedDate }}</span>
              <Icon icon="mdi:chevron-down" class="chevron" />
            </button>
          </div>

          <KitCalendar
            v-if="isCalendarOpen"
            v-model="calendarDate"
            class="calendar-popover"
          />
        </div>

        <div v-else class="timeless-info-banner">
          <Icon icon="mdi:calendar-sync-outline" class="banner-icon" />
          <div class="banner-text">
            Трата не привязана ко дню и учитывается в общей смете поездки
          </div>
          <button type="button" class="restore-date-btn" @click="setToday">
            Указать дату
          </button>
        </div>
      </div>

      <!-- 6. Spontaneous Expense Switch Card -->
      <div
        class="spontaneous-card"
        :class="{ active: form.isSpontaneous }"
        role="button"
        tabindex="0"
        @click="form.isSpontaneous = !form.isSpontaneous"
        @keydown.space.prevent="form.isSpontaneous = !form.isSpontaneous"
      >
        <div class="spontaneous-icon-wrap">
          <Icon icon="mdi:sparkles" class="sparkle-icon" />
        </div>

        <div class="spontaneous-content">
          <div class="spontaneous-title">
            Вне плана <span class="spontaneous-badge">Спонтанно</span>
          </div>
          <div class="spontaneous-desc">
            Сувениры, незапланированные развлечения и покупки вне основного плана
          </div>
        </div>

        <div class="spontaneous-switch">
          <span class="switch-track" :class="{ on: form.isSpontaneous }">
            <span class="switch-thumb" />
          </span>
        </div>
      </div>

      <!-- 7. Notes -->
      <div class="form-row">
        <KitInput
          v-model="form.notes"
          type="textarea"
          label="Заметки"
          placeholder="Детали, чек, адрес заведения или ссылки..."
          :rows="2"
        />
      </div>

      <!-- 8. Form Actions -->
      <div class="form-actions">
        <div class="actions-hint">
          <span class="kbd-badge"><kbd>Enter</kbd> сохранить</span>
        </div>

        <div class="action-buttons">
          <KitBtn variant="text" @click="emit('update:visible', false)">
            Отмена
          </KitBtn>
          <KitBtn type="submit" :disabled="isSaveDisabled" icon="mdi:check">
            Сохранить
          </KitBtn>
        </div>
      </div>
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.transaction-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

// 1. Status Segmented Control
.status-segmented-control {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background-color: var(--bg-tertiary-color);
  padding: 4px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.status-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: var(--r-s);
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;

  .tab-icon {
    font-size: 1.15rem;
    transition: transform 0.15s ease;
  }

  &.active {
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    box-shadow: var(--s-xs);
    font-weight: 600;

    .tab-icon.success {
      color: var(--fg-success-color, #10b981);
    }

    .tab-icon.planned {
      color: var(--fg-info-color, #3b82f6);
    }
  }

  &:hover:not(.active) {
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
  }
}

// 2. Hero Amount Card
.hero-amount-card {
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:focus-within {
    border-color: var(--border-focus-color, var(--fg-accent-color));
    box-shadow: 0 0 0 1px var(--border-focus-color, var(--fg-accent-color));
  }
}

.hero-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-field-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-tertiary-color);
}

.conversion-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: var(--bg-primary-color);
  padding: 3px 8px;
  border-radius: var(--r-xs);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-accent-color);

  .swap-icon {
    font-size: 0.9rem;
  }
}

.hero-input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.hero-amount-input-box {
  flex: 1;
}

.hero-amount-input {
  width: 100%;
  font-size: 1.85rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--fg-primary-color);
  background: transparent;
  border: none;
  outline: none;

  &::placeholder {
    color: var(--fg-muted-color);
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  -moz-appearance: textfield;
}

.currency-picker-wrap {
  position: relative;
}

.currency-trigger-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 12px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  .chevron {
    font-size: 1.1rem;
    color: var(--fg-tertiary-color);
    transition: transform 0.15s ease;
  }

  &.is-active {
    border-color: var(--border-focus-color, var(--fg-accent-color));

    .chevron {
      transform: rotate(180deg);
    }
  }

  &:hover:not(.is-active) {
    border-color: var(--border-secondary-color);
  }
}

.currency-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 220px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  box-shadow: var(--s-m);
  padding: 8px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.currency-search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-xs);
  padding: 4px 8px;

  .search-ico {
    font-size: 0.9rem;
    color: var(--fg-tertiary-color);
  }

  .search-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.8rem;
    color: var(--fg-primary-color);
    text-transform: uppercase;

    &::placeholder {
      text-transform: none;
      color: var(--fg-muted-color);
    }
  }

  .apply-code-btn {
    border: none;
    background: var(--fg-accent-color);
    color: var(--fg-inverted-color);
    border-radius: var(--r-xs);
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
}

.curr-section {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .curr-section-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--fg-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-left: 2px;
  }
}

.curr-chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.curr-chip-btn {
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  border-radius: var(--r-xs);
  padding: 3px 7px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }

  &.selected {
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
    border-color: var(--fg-accent-color);
    font-weight: 600;
  }
}

.hero-rate-footnote {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  padding-top: 2px;

  .rate-icon {
    font-size: 0.9rem;
    color: var(--fg-muted-color);
  }
}

// 4. Category
.category-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.manage-categories-link {
  font-size: 0.8rem;
  padding: 2px 6px;
  height: auto;
}

.quick-category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 2px;
}

.quick-category-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--r-xs);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;

  .cat-chip-icon {
    font-size: 0.95rem;
  }

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }

  &.active {
    background-color: var(--bg-hover-color);
    border-color: var(--border-focus-color, var(--fg-accent-color));
    color: var(--fg-accent-color);
    font-weight: 500;
  }
}

// 5. Date & Timeless
.date-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timeless-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: color 0.15s;

  .check-ico {
    font-size: 0.95rem;
  }

  &.active {
    color: var(--fg-accent-color);
    font-weight: 500;
  }

  &:hover:not(.active) {
    color: var(--fg-primary-color);
  }
}

.date-picker-box {
  position: relative;
}

.date-controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-date-chips {
  display: flex;
  gap: 4px;
}

.date-chip-btn {
  padding: 0 10px;
  height: 40px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-primary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-secondary-color);
  }

  &.active {
    background-color: var(--bg-hover-color);
    border-color: var(--border-focus-color, var(--fg-accent-color));
    color: var(--fg-accent-color);
  }
}

.date-picker-trigger {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;

  .cal-ico {
    font-size: 1.1rem;
    color: var(--fg-tertiary-color);
    margin-right: 8px;
  }

  .date-label-text {
    flex: 1;
    text-align: left;
  }

  .chevron {
    font-size: 1.1rem;
    color: var(--fg-tertiary-color);
    transition: transform 0.15s ease;
  }

  &.is-open {
    border-color: var(--border-focus-color, var(--fg-accent-color));

    .chevron {
      transform: rotate(180deg);
    }
  }

  &:hover:not(.is-open) {
    border-color: var(--border-secondary-color);
  }
}

.calendar-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  box-shadow: var(--s-m);
}

.timeless-info-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 10px 14px;

  .banner-icon {
    font-size: 1.3rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  .banner-text {
    flex: 1;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    line-height: 1.35;
  }

  .restore-date-btn {
    border: none;
    background: none;
    color: var(--fg-accent-color);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    padding: 2px 4px;

    &:hover {
      text-decoration: underline;
    }
  }
}

// 6. Spontaneous Card
.spontaneous-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 0.85rem 1rem;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-secondary-color);
  }

  &.active {
    border-color: rgba(189, 16, 224, 0.45);
    background-color: rgba(189, 16, 224, 0.05);

    .sparkle-icon {
      color: #c026d3;
      transform: scale(1.1);
    }
  }
}

.spontaneous-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  flex-shrink: 0;

  .sparkle-icon {
    font-size: 1.25rem;
    color: var(--fg-tertiary-color);
    transition: all 0.2s ease;
  }
}

.spontaneous-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spontaneous-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  gap: 6px;
}

.spontaneous-badge {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: rgba(189, 16, 224, 0.12);
  color: #c026d3;
}

.spontaneous-desc {
  font-size: 0.775rem;
  color: var(--fg-secondary-color);
  line-height: 1.3;
}

.spontaneous-switch {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.switch-track {
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background-color: var(--bg-disabled-color, #353535);
  position: relative;
  transition: background-color 0.2s ease;

  &.on {
    background-color: #c026d3;

    .switch-thumb {
      transform: translateX(16px);
    }
  }
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

// 8. Actions
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.85rem;
  border-top: 1px solid var(--border-secondary-color);
}

.actions-hint {
  .kbd-badge {
    font-size: 0.75rem;
    color: var(--fg-tertiary-color);

    kbd {
      padding: 2px 5px;
      font-size: 0.7rem;
      border-radius: 4px;
      border: 1px solid var(--border-primary-color);
      background-color: var(--bg-secondary-color);
      color: var(--fg-secondary-color);
    }
  }
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
