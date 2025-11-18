<script setup lang="ts">
import type { FinancesSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { onClickOutside } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendarRange } from '~/components/01.kit/kit-calendar-range'
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
  selectedCategoryFilters,
  dateFilter,
  toggleCategoryFilter,
  openTransactionForm,
  saveTransaction,
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

const categoryFilterItems = computed(() => {
  const items = categories.value.map(c => ({ value: c.id, label: c.name, icon: c.icon }))
  items.unshift({ value: null, label: 'Все категории', icon: 'mdi:format-list-bulleted' } as any)
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
    <FinancesDashboard
      :main-currency="settings.mainCurrency"
      :spending-by-category="spendingByCategory"
      :spending-by-day="spendingByDay"
    />

    <div class="list-controls">
      <div class="category-filter-pills">
        <button
          v-for="item in categoryFilterItems"
          :key="String(item.value)"
          class="filter-pill"
          :class="{ active: item.value === null ? selectedCategoryFilters.length === 0 : selectedCategoryFilters.includes(item.value) }"
          @click="toggleCategoryFilter(item.value)"
        >
          <Icon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      </div>

      <div class="actions-and-filters">
        <div class="list-actions">
          <KitBtn v-if="!readonly" icon="mdi:plus" @click="openTransactionForm()">
            Добавить трату
          </KitBtn>
          <KitBtn v-if="!readonly" icon="mdi:magic-staff" variant="outlined" @click="isAiCreatorOpen = !isAiCreatorOpen">
            AI
          </KitBtn>
          <KitBtn v-if="!readonly" icon="mdi:tag-outline" variant="text" @click="handleOpenCategoryManager">
            Категории
          </KitBtn>
          <KitBtn v-if="!readonly" icon="mdi:cog-outline" variant="text" @click="isSettingsOpen = true">
            Настройки
          </KitBtn>
        </div>

        <div ref="dateFilterWrapperRef" class="date-filter-wrapper">
          <KitBtn
            icon="mdi:calendar-blank-outline"
            variant="text"
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
      @edit-transaction="openTransactionForm"
      @delete-transaction="deleteTransaction"
    />

    <TransactionFormDialog
      v-model:visible="isTransactionFormOpen"
      :transaction="transactionToEdit"
      :categories="categories"
      :main-currency="settings.mainCurrency"
      @save="saveTransaction"
      @open-category-manager="handleOpenCategoryManager"
    />

    <CategoryManagerDialog
      v-model:visible="isCategoryManagerOpen"
      :categories="categories"
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
}

.ai-creator-wrapper {
  margin-top: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
}

.list-controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.category-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 6px 12px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-accent-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background-color: var(--bg-accent-color);
    border-color: var(--bg-accent-color);
    color: var(--fg-on-accent-color);
  }
}

.actions-and-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
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

.list-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@include media-down(sm) {
  .actions-and-filters {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .date-filter-wrapper {
    order: 1;
  }
  .list-actions {
    order: 2;
    justify-content: flex-end;
  }
}
</style>
