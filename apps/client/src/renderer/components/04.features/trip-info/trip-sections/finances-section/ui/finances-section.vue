<script setup lang="ts">
import type { FinancesSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { vRipple } from '~/shared/directives/ripple'
import { useFinancesSection } from '../composables'
import AiFinancesCreator from './components/ai-finances-creator.vue'
import BudgetSettingsDialog from './components/budget-settings-dialog.vue'
import CategoryManagerDialog from './components/category-manager-dialog.vue'
import FinancesDashboard from './components/finances-dashboard.vue'
import FinancesDateFilter from './components/finances-date-filter.vue'
import TransactionFormDialog from './components/transaction-form-dialog.vue'
import TransactionsList from './components/transactions-list.vue'

interface Props {
  section: {
    id: string
    tripId?: string
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
  excludedCategoryFilters,
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

const transactionFormVisibleBeforeCategoryManager = ref(false)

const hasActiveFilters = computed(() => {
  return statusFilter.value !== 'all'
    || typeFilter.value !== 'all'
    || selectedCategoryFilters.value.length > 0
    || excludedCategoryFilters.value.length > 0
    || !!dateFilter.value.start
    || !!dateFilter.value.end
})
const activeFiltersCount = computed(() => {
  let count = 0

  if (statusFilter.value !== 'all')
    count++

  if (typeFilter.value !== 'all')
    count++

  count += selectedCategoryFilters.value.length + excludedCategoryFilters.value.length

  if (dateFilter.value.start || dateFilter.value.end)
    count++

  return count
})
const categoryFilterList = computed(() => {
  const items = categories.value.map((c) => {
    return { value: c.id, label: c.name || (c.id === 'cat-other' ? 'Прочее' : 'Без названия'), icon: c.icon }
  })

  if (!items.some(i => i.value === 'cat-other')) {
    items.push({ value: 'cat-other', label: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline' })
  }

  return items
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

function handleOpenCategoryManager() {
  if (isTransactionFormOpen.value) {
    isTransactionFormOpen.value = false
    transactionFormVisibleBeforeCategoryManager.value = true
  }

  isCategoryManagerOpen.value = true
}
function resetAllFilters() {
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  toggleCategoryFilter(null)
  dateFilter.value = { start: null, end: null }
}
</script>

<template>
  <div class="finances-section">
    <!-- IMP-027 Панель управления финансами -->
    <div class="finances-control-card" :class="{ 'is-readonly': readonly }">
      <div class="control-card-header">
        <h2 class="control-card-title">
          Финансы
        </h2>
        <KitBtn
          v-if="!readonly"
          icon="mdi:tune-variant"
          variant="text"
          size="md"
          class="settings-btn"
          title="Настройки бюджета и валют"
          @click="isSettingsOpen = true"
        >
          <span>Настройки</span>
        </KitBtn>
      </div>

      <div v-if="!readonly" class="control-card-actions">
        <KitBtn
          icon="mdi:plus"
          variant="solid"
          size="md"
          class="action-primary"
          title="Добавить трату вручную"
          @click="openTransactionForm()"
        >
          <span>Добавить трату</span>
        </KitBtn>

        <KitBtn
          icon="mdi:line-scan"
          variant="tonal"
          size="md"
          class="action-secondary"
          :class="{ 'is-active': isAiCreatorOpen }"
          title="Быстрый ввод списка трат через AI или распознавание чека"
          @click="isAiCreatorOpen = !isAiCreatorOpen"
        >
          <span>По чеку</span>
        </KitBtn>
      </div>

      <div v-if="!readonly" class="control-card-footer">
        <span class="control-card-subtitle">Управление расходами</span>
        <KitBtn
          icon="mdi:tag-outline"
          variant="text"
          size="md"
          class="categories-btn"
          title="Управление категориями расходов"
          @click="handleOpenCategoryManager"
        >
          <span>Категории</span>
          <Icon icon="mdi:chevron-right" class="chevron-icon" />
        </KitBtn>
      </div>
    </div>

    <!-- Быстрый AI-ввод по чеку -->
    <div v-if="!readonly" v-show="isAiCreatorOpen" class="ai-creator-wrapper">
      <AiFinancesCreator
        :categories="categories"
        :settings="settings"
        :trip-id="section.tripId"
        @close="isAiCreatorOpen = false"
        @save="addMultipleTransactions"
      />
    </div>

    <div v-if="missingCurrencyCodes.length" class="currency-warning">
      <Icon icon="mdi:currency-usd-off" />
      Курс для {{ missingCurrencyCodes.join(', ') }} не задан: такие траты исключены из итогов и диаграмм.
    </div>

    <div class="finances-filters-bar">
      <!-- Строка 1: Статус + Период + Быстрый сброс -->
      <div class="filters-meta-row">
        <!-- Статусный сегментированный переключатель: Все / Оплачено / В планах -->
        <div class="status-segmented-control">
          <button
            v-ripple
            type="button"
            class="status-segment-btn"
            :class="{ 'is-active': statusFilter === 'all' }"
            @click="statusFilter = 'all'"
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
            <span v-if="activeFiltersCount > 0" class="reset-badge">{{ activeFiltersCount }}</span>
          </button>

          <!-- Выбор периода по дате -->
          <FinancesDateFilter
            v-model="dateFilter"
            :min-value="availableDateRange.minValue"
            :max-value="availableDateRange.maxValue"
          />
        </div>
      </div>

      <!-- Строка 2: Категории расходов и быстрые фильтры -->
      <div class="category-filters-row">
        <div class="category-filter-pills">
          <!-- Все категории -->
          <button
            v-ripple
            type="button"
            class="filter-pill category-pill is-all"
            :class="{ active: selectedCategoryFilters.length === 0 && excludedCategoryFilters.length === 0 }"
            @click="toggleCategoryFilter(null)"
          >
            <Icon icon="mdi:format-list-bulleted" class="pill-icon" />
            <span>Все категории</span>
          </button>

          <!-- Спонтанные расходы -->
          <button
            v-ripple
            type="button"
            class="filter-pill category-pill is-spontaneous"
            :class="{ active: typeFilter === 'spontaneous' }"
            @click="typeFilter = typeFilter === 'spontaneous' ? 'all' : 'spontaneous'"
          >
            <Icon icon="mdi:sparkles" class="pill-icon" />
            <span>Спонтанно</span>
          </button>

          <!-- Категории трат -->
          <button
            v-for="item in categoryFilterList"
            :key="String(item.value)"
            v-ripple
            type="button"
            class="filter-pill category-pill"
            :class="{
              active: selectedCategoryFilters.includes(item.value),
              excluded: excludedCategoryFilters.includes(item.value),
            }"
            :aria-label="`${item.label}: ${selectedCategoryFilters.includes(item.value) ? 'только эта категория; нажмите, чтобы исключить' : excludedCategoryFilters.includes(item.value) ? 'исключена; нажмите, чтобы сбросить' : 'без фильтра; нажмите, чтобы выбрать только эту категорию'}`"
            :aria-pressed="selectedCategoryFilters.includes(item.value) || excludedCategoryFilters.includes(item.value)"
            @click="toggleCategoryFilter(item.value)"
          >
            <Icon :icon="item.icon" class="pill-icon" />
            <span>{{ item.label }}</span>
            <span v-if="selectedCategoryFilters.includes(item.value)" class="pill-state">Только</span>
            <span v-else-if="excludedCategoryFilters.includes(item.value)" class="pill-state">Исключено</span>
          </button>

          <!-- Управление категориями рядом с фильтрами -->
          <button
            v-if="!readonly"
            v-ripple
            type="button"
            class="filter-pill manage-categories-filter-pill"
            title="Управление категориями"
            @click="handleOpenCategoryManager"
          >
            <Icon icon="mdi:tag-outline" class="pill-icon" />
            <span>Категории</span>
            <Icon icon="mdi:chevron-right" class="pill-chevron" />
          </button>
        </div>
      </div>
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
      :trip-id="section.tripId"
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
  padding: 4px 14px;
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  white-space: nowrap;
  height: 30px;

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

.meta-controls-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reset-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  height: 32px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg-muted-color);
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
  user-select: none;

  .reset-icon {
    font-size: 0.95rem;
  }

  .reset-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    border-radius: var(--r-full);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
  }

  &:hover {
    color: var(--fg-accent-color);
    border-color: color-mix(in srgb, var(--fg-accent-color) 40%, transparent);
    background-color: color-mix(in srgb, var(--fg-accent-color) 10%, var(--bg-secondary-color));
  }
}

.date-filter-wrapper {
  position: relative;
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
  padding: 4px 12px;
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

    &.is-spontaneous {
      background-color: rgba(189, 16, 224, 0.14);
      border-color: #bd10e0;
      color: #bd10e0;

      .pill-icon,
      svg {
        color: #bd10e0;
      }
    }
  }

  &.excluded {
    border-style: dashed;
    border-color: var(--fg-secondary-color);
    background-color: var(--bg-tertiary-color);

    > span:first-of-type {
      text-decoration: line-through;
    }
  }

  .pill-state {
    font-size: 0.7rem;
    font-weight: 700;
  }

  &.is-spontaneous:not(.active) {
    border-style: dashed;
    border-color: color-mix(in srgb, #bd10e0 40%, var(--border-secondary-color));

    .pill-icon,
    svg {
      color: #bd10e0;
      opacity: 0.7;
    }
  }

  &.manage-categories-filter-pill {
    border-style: dashed;
    color: var(--fg-muted-color);
    padding: 4px 10px;

    .pill-chevron {
      font-size: 0.95rem;
      flex-shrink: 0;
      opacity: 0.7;
      margin-left: -2px;
    }

    &:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background-color: color-mix(in srgb, var(--fg-accent-color) 8%, var(--bg-secondary-color));

      .pill-icon,
      .pill-chevron {
        color: var(--fg-accent-color);
        opacity: 1;
      }
    }
  }
}

/* IMP-027: Панель управления финансами */
.finances-control-card {
  width: 100%;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 1.15rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: var(--shadow-s);

  &.is-readonly {
    padding: 1rem 1.25rem;
    gap: 0;
  }
}

.control-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.control-card-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--fg-primary-color);
  letter-spacing: -0.01em;
}

.control-card-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .action-primary {
    flex: 0 0 auto;
    min-height: 44px;
    height: 44px;
    padding: 0 1.5rem;
    border-radius: var(--r-s);
    font-size: 0.9rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .action-secondary {
    flex: 0 0 auto;
    min-height: 44px;
    height: 44px;
    padding: 0 1.25rem;
    border-radius: var(--r-s);
    border: 1px solid var(--border-secondary-color);
    background-color: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;

    .kit-btn-icon {
      color: var(--fg-accent-color);
      font-size: 1.2rem;
    }

    &:hover:not(:disabled) {
      border-color: var(--border-primary-color);
      background-color: var(--bg-hover-color, var(--bg-primary-color));
    }

    &.is-active {
      border-color: var(--fg-accent-color);
      background-color: color-mix(in srgb, var(--fg-accent-color) 14%, var(--bg-secondary-color));
      color: var(--fg-accent-color);

      .kit-btn-icon {
        color: var(--fg-accent-color);
      }
    }
  }
}

.control-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.25rem;
  border-top: 1px solid color-mix(in srgb, var(--border-secondary-color) 50%, transparent);
}

.control-card-subtitle {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fg-muted-color);
  user-select: none;
}

.settings-btn,
.categories-btn {
  min-height: 44px;
  color: var(--fg-secondary-color);
  border-radius: var(--r-s);
  border: 1px solid transparent;
  background-color: transparent;
  box-shadow: none;
  font-size: 0.84rem;
  font-weight: 500;
  padding: 0.375rem 0.65rem;
  transition: all 0.2s ease;
  white-space: nowrap;

  .chevron-icon {
    font-size: 1.125rem;
    margin-left: 2px;
    opacity: 0.6;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
  }

  &:hover:not(:disabled) {
    color: var(--fg-primary-color);
    background-color: var(--bg-tertiary-color);
    border-color: var(--border-secondary-color);
    box-shadow: none;

    .chevron-icon {
      opacity: 1;
      transform: translateX(2px);
    }
  }
}

.ai-creator-wrapper {
  padding: 1rem;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
}

@include media-down(sm) {
  .finances-control-card {
    padding: 0.95rem;
    gap: 0.875rem;

    .control-card-header {
      .control-card-title {
        font-size: 1.25rem;
      }
    }

    .control-card-actions {
      display: flex;
      gap: 0.5rem;
      width: 100%;

      .action-primary {
        flex: 6 1 0;
        min-width: 0;
        padding: 0 0.75rem;
        font-size: 0.8125rem;

        .kit-btn-content {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .action-secondary {
        flex: 4 1 0;
        min-width: 0;
        padding: 0 0.625rem;
        font-size: 0.8125rem;

        .kit-btn-content {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .control-card-footer {
      padding-top: 0.25rem;

      .control-card-subtitle {
        font-size: 0.75rem;
      }

      .categories-btn {
        padding: 0.25rem 0.5rem;
        font-size: 0.8125rem;
      }
    }
  }

  @media (max-width: 360px) {
    .finances-control-card {
      .control-card-actions {
        flex-direction: column;
        gap: 0.5rem;

        .action-primary,
        .action-secondary {
          width: 100%;
          flex: none;
        }
      }
    }
  }

  .finances-filters-bar {
    gap: 0.65rem;

    .filters-meta-row {
      flex-direction: column;
      align-items: stretch;
      gap: 0.65rem;
    }

    .status-segmented-control {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      padding: 3px;
      gap: 3px;

      .status-segment-btn {
        width: 100%;
        height: 36px;
        padding: 0 4px;
        font-size: 0.8125rem;
        justify-content: center;
      }
    }

    .meta-controls-group {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;

      .date-filter-wrapper,
      :deep(.finances-date-filter) {
        flex: 1;
        min-width: 0;

        .date-filter-btn {
          width: 100%;
          height: 36px;
          justify-content: center;

          .date-filter-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      .reset-filters-btn {
        height: 36px;
        padding: 0 12px;
        flex-shrink: 0;
      }
    }

    .category-filters-row {
      width: 100%;
      overflow: hidden;

      .category-filter-pills {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        gap: 6px;
        padding: 2px 4px 6px 4px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        scroll-behavior: smooth;
        overscroll-behavior-x: contain;

        &::-webkit-scrollbar {
          display: none;
        }

        .filter-pill {
          flex-shrink: 0;
          height: 32px;
          padding: 0 12px;
          white-space: nowrap;
        }
      }
    }
  }
}
</style>
