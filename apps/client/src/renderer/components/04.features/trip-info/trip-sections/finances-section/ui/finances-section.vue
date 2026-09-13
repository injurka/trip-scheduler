<script setup lang="ts">
import type { FinancesSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { onClickOutside } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendarRange } from '~/components/01.kit/kit-calendar-range'
import { vRipple } from '~/shared/directives/ripple'
import { useFinancesSection } from '../composables'
import AiFinancesCreator from './components/ai-finances-creator.vue'
import BudgetSettingsDialog from './components/budget-settings-dialog.vue'
import CategoryManagerDialog from './components/category-manager-dialog.vue'
import FinancesDashboard from './components/finances-dashboard.vue'
import TransactionFormDialog from './components/transaction-form-dialog.vue'
import TransactionsList from './components/transactions-list.vue'

interface Props {
  section: {
    id: string
    type: 'finances'
    content: FinancesSectionContent
  }
  readonly: boolean
}
const props = defineProps<Props>()
const emit = defineEmits(['updateSection'])

const {
  categories,
  settings,
  isTransactionFormOpen,
  isCategoryManagerOpen,
  isSettingsOpen,
  isAiCreatorOpen,
  transactionToEdit,
  spendingByCategory,
  spendingByDay,
  filteredTransactions,
  filteredTotal,
  missingCurrencyCodes,
  overallBudget,
  paidTotal,
  plannedTotal,
  spontaneousTotal,
  selectedCategoryFilters,
  dateFilter,
  typeFilter,
  statusFilter,
  toggleCategoryFilter,
  openTransactionForm,
  saveTransaction,
  toggleTransactionStatus,
  addMultipleTransactions,
  deleteTransaction,
  saveCategory,
  deleteCategory,
  saveSettings,
} = useFinancesSection(props, emit)

const isDateFilterOpen = ref(false)
const dateFilterWrapperRef = ref(null)
const transactionFormVisibleBeforeCategoryManager = ref(false)

function handleOpenCategoryManager() {
  if (isTransactionFormOpen.value) {
    isTransactionFormOpen.value = false
    transactionFormVisibleBeforeCategoryManager.value = true
  }
  isCategoryManagerOpen.value = true
}

function clearDateFilter() {
  dateFilter.value = { start: null, end: null }
  isDateFilterOpen.value = false
}

const hasActiveFilters = computed(() => {
  return statusFilter.value !== 'all'
    || typeFilter.value !== 'all'
    || selectedCategoryFilters.value.length > 0
    || !!dateFilter.value.start
    || !!dateFilter.value.end
})

function resetAllFilters() {
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  selectedCategoryFilters.value = []
  dateFilter.value = { start: null, end: null }
}

const categoryFilterItems = computed(() => {
  const items = categories.value.map((c) => {
    return { value: c.id, label: c.name || (c.id === 'cat-other' ? 'Прочее' : 'Без названия'), icon: c.icon }
  })

  if (!items.some(i => i.value === 'cat-other')) {
    items.push({ value: 'cat-other', label: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline' })
  }

  items.unshift({ value: 'ALL', label: 'Все категории', icon: 'mdi:format-list-bulleted' } as any)

  return items
})

const formattedDateFilter = computed(() => {
  const { start, end } = dateFilter.value
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

const calendarDateFilter = computed({
  get() {
    return {
      start: dateFilter.value.start ? parseDate(dateFilter.value.start) : null,
      end: dateFilter.value.end ? parseDate(dateFilter.value.end) : null,
    }
  },
  set(range) {
    dateFilter.value = {
      start: range.start ? range.start.toString() : null,
      end: range.end ? range.end.toString() : null,
    }
  },
})

const availableDateRange = computed(() => {
  const transactions = props.section.content.transactions
  if (!transactions || transactions.length === 0) {
    return { minValue: undefined, maxValue: undefined }
  }

  const timestamps = transactions
    .filter(t => !!t.date)
    .map(t => new Date(t.date!).getTime())

  if (timestamps.length === 0) {
    return { minValue: undefined, maxValue: undefined }
  }

  const minTimestamp = Math.min(...timestamps)
  const maxTimestamp = Math.max(...timestamps)

  const minDateStr = new Date(minTimestamp).toISOString().split('T')[0]
  const maxDateStr = new Date(maxTimestamp).toISOString().split('T')[0]

  return {
    minValue: parseDate(minDateStr),
    maxValue: parseDate(maxDateStr),
  }
})

watch(isCategoryManagerOpen, (isOpen) => {
  if (!isOpen && transactionFormVisibleBeforeCategoryManager.value) {
    isTransactionFormOpen.value = true
    transactionFormVisibleBeforeCategoryManager.value = false
  }
})

onClickOutside(dateFilterWrapperRef, () => {
  isDateFilterOpen.value = false
})
</script>

<template>
  <div class="finances-section">
    <div class="finances-filters-bar">
      <!-- Строка 1: Мета-фильтры (Статус / Тип) + Период + Быстрый сброс -->
      <div class="filters-meta-row">
        <div class="meta-filters-group">
          <!-- Статусный сегментированный переключатель: Все / Оплачено / В планах -->
          <div class="status-segmented-control">
            <button
              v-ripple
              type="button"
              class="status-segment-btn"
              :class="{ 'is-active': statusFilter === 'all' && typeFilter === 'all' }"
              @click="statusFilter = 'all'; typeFilter = 'all'"
            >
              <Icon icon="mdi:format-list-bulleted" class="segment-icon" />
              <span>Все</span>
            </button>
            <button
              v-ripple
              type="button"
              class="status-segment-btn is-paid"
              :class="{ 'is-active': statusFilter === 'paid' }"
              @click="statusFilter = statusFilter === 'paid' ? 'all' : 'paid'"
            >
              <Icon icon="mdi:check-circle-outline" class="segment-icon" />
              <span>Оплачено</span>
            </button>
            <button
              v-ripple
              type="button"
              class="status-segment-btn is-planned"
              :class="{ 'is-active': statusFilter === 'planned' }"
              @click="statusFilter = statusFilter === 'planned' ? 'all' : 'planned'"
            >
              <Icon icon="mdi:clock-outline" class="segment-icon" />
              <span>В планах</span>
            </button>
          </div>

          <!-- Фильтр-флаг: Спонтанные расходы -->
          <button
            v-ripple
            type="button"
            class="type-pill-btn is-spontaneous"
            :class="{ 'is-active': typeFilter === 'spontaneous' }"
            @click="typeFilter = typeFilter === 'spontaneous' ? 'all' : 'spontaneous'"
          >
            <Icon icon="mdi:sparkles" class="type-icon" />
            <span>Спонтанно</span>
          </button>
        </div>

        <div class="meta-controls-group">
          <!-- Кнопка сброса всех фильтров при активной фильтрации -->
          <button
            v-if="hasActiveFilters"
            v-ripple
            type="button"
            class="reset-filters-btn"
            title="Сбросить все активные фильтры"
            @click="resetAllFilters"
          >
            <Icon icon="mdi:filter-off-outline" class="reset-icon" />
            <span>Сбросить</span>
          </button>

          <!-- Выбор периода по дате -->
          <div ref="dateFilterWrapperRef" class="date-filter-wrapper">
            <KitBtn
              icon="mdi:calendar-blank-outline"
              variant="tonal"
              size="sm"
              :class="{ 'has-active-filter': dateFilter.start || dateFilter.end }"
              @click="isDateFilterOpen = !isDateFilterOpen"
            >
              {{ formattedDateFilter }}
            </KitBtn>
            <div v-if="isDateFilterOpen" class="calendar-popover">
              <KitCalendarRange
                v-model="calendarDateFilter"
                :min-value="availableDateRange.minValue"
                :max-value="availableDateRange.maxValue"
                :initial-focus-date="availableDateRange.maxValue"
              />
              <div class="popover-actions">
                <KitBtn variant="text" size="sm" @click="clearDateFilter">
                  Сбросить
                </KitBtn>
                <KitBtn size="sm" @click="isDateFilterOpen = false">
                  Применить
                </KitBtn>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Строка 2: Категории расходов -->
      <div class="category-filters-row">
        <div class="category-filter-pills">
          <button
            v-for="item in categoryFilterItems"
            :key="String(item.value)"
            v-ripple
            type="button"
            class="filter-pill category-pill"
            :class="{
              'active': item.value === 'ALL' ? selectedCategoryFilters.length === 0 : selectedCategoryFilters.includes(item.value),
              'is-all': item.value === 'ALL',
            }"
            @click="item.value === 'ALL' ? toggleCategoryFilter(null) : toggleCategoryFilter(item.value)"
          >
            <Icon :icon="item.icon" class="pill-icon" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="missingCurrencyCodes.length" class="currency-warning">
      <Icon icon="mdi:currency-usd-off" />
      Курс для {{ missingCurrencyCodes.join(', ') }} не задан: такие траты исключены из итогов и диаграмм.
    </div>

    <FinancesDashboard
      :main-currency="settings.mainCurrency"
      :spending-by-category="spendingByCategory"
      :spending-by-day="spendingByDay"
      :overall-budget="overallBudget"
      :paid-total="paidTotal"
      :planned-total="plannedTotal"
      :spontaneous-total="spontaneousTotal"
      :filtered-total="filteredTotal"
      :status-filter="statusFilter"
    />

    <div class="toolbar">
      <div class="main-actions">
        <KitBtn
          v-if="!readonly"
          icon="mdi:plus"
          variant="solid"
          size="sm"
          @click="openTransactionForm()"
        >
          Добавить трату
        </KitBtn>
        <KitBtn
          v-if="!readonly"
          icon="mdi:auto-fix"
          variant="tonal"
          :class="{ active: isAiCreatorOpen }"
          title="Быстрый ввод списка трат через AI или распознавание чека"
          size="sm"
          @click="isAiCreatorOpen = !isAiCreatorOpen"
        >
          Чек / AI-ввод
        </KitBtn>
      </div>

      <div class="secondary-actions">
        <KitBtn
          v-if="!readonly"
          size="sm" icon="mdi:tag-outline"
          variant="tonal"
          title="Управление категориями"
          @click="handleOpenCategoryManager"
        />
        <KitBtn
          v-if="!readonly"
          size="sm" icon="mdi:cog-outline"
          variant="tonal"
          title="Настройки"
          @click="isSettingsOpen = true"
        />
      </div>
    </div>

    <div v-if="!readonly" v-show="isAiCreatorOpen" class="ai-creator-wrapper">
      <AiFinancesCreator
        :categories="categories"
        :settings="settings"
        @close="isAiCreatorOpen = false"
        @save="addMultipleTransactions"
      />
    </div>

    <TransactionsList
      :transactions="filteredTransactions"
      :categories="categories"
      :settings="settings"
      :readonly="readonly"
      :filtered-total="filteredTotal"
      :status-filter="statusFilter"
      @edit-transaction="openTransactionForm"
      @delete-transaction="deleteTransaction"
      @toggle-status="toggleTransactionStatus"
    />

    <TransactionFormDialog
      v-model:visible="isTransactionFormOpen"
      :transaction="transactionToEdit"
      :categories="categories"
      :main-currency="settings.mainCurrency"
      :exchange-rates="settings.exchangeRates"
      @save="saveTransaction"
      @open-category-manager="handleOpenCategoryManager"
    />

    <CategoryManagerDialog
      v-model:visible="isCategoryManagerOpen"
      :categories="categories"
      :main-currency="settings.mainCurrency"
      :total-budget="settings.totalBudget"
      @save="saveCategory"
      @delete="deleteCategory"
    />

    <BudgetSettingsDialog
      v-model:visible="isSettingsOpen"
      :settings="settings"
      @save="saveSettings"
    />
  </div>
</template>

<style scoped lang="scss">
.finances-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  z-index: 6;
}

.currency-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, #f59e0b 45%, var(--border-secondary-color));
  border-radius: var(--r-s);
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 10%, transparent);
  font-size: 0.82rem;
}

.finances-filters-bar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.filters-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.meta-filters-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-segmented-control {
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  padding: 3px;
  gap: 2px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

.status-segment-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  height: 28px;

  .segment-icon {
    font-size: 0.95rem;
    flex-shrink: 0;
  }

  &:hover:not(.is-active) {
    color: var(--fg-primary-color);
  }

  &.is-active {
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);

    &.is-paid {
      background-color: rgba(16, 185, 129, 0.16);
      color: #10b981;
      .segment-icon {
        color: #10b981;
      }
    }

    &.is-planned {
      background-color: rgba(59, 130, 246, 0.16);
      color: #3b82f6;
      .segment-icon {
        color: #3b82f6;
      }
    }
  }
}

.type-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  height: 34px;
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px dashed var(--border-primary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  user-select: none;
  transition: all 0.18s ease;

  .type-icon {
    font-size: 0.95rem;
    flex-shrink: 0;
  }

  &:hover {
    border-color: var(--border-accent-color);
    color: var(--fg-primary-color);
  }

  &.is-spontaneous.is-active {
    background-color: rgba(189, 16, 224, 0.15);
    border-color: #bd10e0;
    border-style: solid;
    color: #bd10e0;
  }
}

.meta-controls-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reset-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  height: 38px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--fg-muted-color);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-xs);
  cursor: pointer;
  transition: all 0.15s ease;

  .reset-icon {
    font-size: 0.95rem;
  }

  &:hover {
    color: var(--fg-accent-color);
    background-color: color-mix(in srgb, var(--fg-accent-color) 10%, transparent);
  }
}

.category-filters-row {
  width: 100%;
}

.category-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.filter-pill,
.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  height: 32px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.18s ease;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  .pill-icon,
  svg {
    font-size: 0.95rem;
    flex-shrink: 0;
    opacity: 0.8;
    transition: opacity 0.18s ease;
  }

  &:hover {
    border-color: var(--border-primary-color);
    color: var(--fg-primary-color);
    background-color: var(--bg-tertiary-color);

    .pill-icon,
    svg {
      opacity: 1;
    }
  }

  &.active {
    background-color: color-mix(in srgb, var(--fg-accent-color) 14%, var(--bg-secondary-color));
    border-color: color-mix(in srgb, var(--fg-accent-color) 60%, transparent);
    color: var(--fg-accent-color);

    .pill-icon,
    svg {
      opacity: 1;
      color: var(--fg-accent-color);
    }

    &.is-all {
      background-color: var(--bg-primary-color);
      border-color: var(--border-primary-color);
      color: var(--fg-primary-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

      .pill-icon,
      svg {
        color: var(--fg-primary-color);
      }
    }
  }
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.main-actions {
  display: flex;
  gap: 0.5rem;
}

.secondary-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-filter-wrapper {
  position: relative;
}

.calendar-popover {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  z-index: 100;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 0.5rem;
  display: flex;
  align-items: center;
  box-shadow: var(--shadow-l);
}

.popover-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--border-secondary-color);
}

.ai-creator-wrapper {
  padding: 1rem;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
}

@include media-down(sm) {
  .finances-filters-bar {
    gap: 0.5rem;

    .filters-meta-row {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .meta-filters-group {
      width: 100%;
    }

    .status-segmented-control {
      flex: 1;
      justify-content: space-between;

      .status-segment-btn {
        flex: 1;
        justify-content: center;
        padding: 4px 6px;
      }
    }

    .meta-controls-group {
      width: 100%;
      justify-content: space-between;

      .date-filter-wrapper {
        flex: 1;

        .kit-btn {
          width: 100%;
          justify-content: center;
        }
      }
    }
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .main-actions {
    justify-content: flex-start;

    button:first-of-type {
      width: 100%;
    }
  }
  .secondary-actions {
    justify-content: space-between;
    width: 100%;
    > button {
      min-width: 46px;
    }
  }
  .date-filter-wrapper {
    flex-grow: 1;
    .kit-btn {
      width: 100%;
      justify-content: center;
    }
  }
  .calendar-popover {
    right: auto;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
}
</style>
