<script setup lang="ts">
import type { Category } from '../../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { useCurrencyFormatter } from '../../composables/use-currency-formatter'
import FinancesIconPicker from './finances-icon-picker.vue'

interface Props {
  visible: boolean
  categories: Category[]
  mainCurrency?: string
  totalBudget?: number
}

const props = withDefaults(defineProps<Props>(), {
  mainCurrency: 'RUB',
  totalBudget: undefined,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', category: Partial<Category>): void
  (e: 'delete', id: string): void
}>()

const { format: formatCurrency } = useCurrencyFormatter()

// Form state for new category
const newCategoryName = ref('')
const newCategoryIcon = ref('mdi:tag-outline')
const newCategoryLimit = ref<number | ''>('')
const searchQuery = ref('')

// Currency symbol (e.g. ₽, $, €)
const currencySymbol = computed(() => {
  const curr = props.mainCurrency || 'RUB'
  try {
    const parts = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: curr }).formatToParts(0)
    const currencyPart = parts.find(p => p.type === 'currency')
    return currencyPart ? currencyPart.value : curr
  }
  catch {
    return curr
  }
})

// Summary metrics
const totalLimits = computed(() => {
  return props.categories.reduce((sum, c) => sum + (c.budgetLimit || 0), 0)
})

const totalLimitsFormatted = computed(() => {
  return formatCurrency(totalLimits.value, props.mainCurrency || 'RUB')
})

const totalBudgetFormatted = computed(() => {
  if (!props.totalBudget)
    return null
  return formatCurrency(props.totalBudget, props.mainCurrency || 'RUB')
})

const budgetAllocationPercent = computed(() => {
  if (!props.totalBudget || props.totalBudget <= 0)
    return 0
  return Math.min(Math.round((totalLimits.value / props.totalBudget) * 100), 100)
})

const isBudgetExceeded = computed(() => {
  if (!props.totalBudget)
    return false
  return totalLimits.value > props.totalBudget
})

const budgetDiffFormatted = computed(() => {
  if (!props.totalBudget)
    return null
  const diff = Math.abs(props.totalBudget - totalLimits.value)
  return formatCurrency(diff, props.mainCurrency || 'RUB')
})

// Filtered categories
const filteredCategories = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return props.categories
  return props.categories.filter(c => c.name.toLowerCase().includes(q))
})

// Handlers
function updateCategoryName(cat: Category, newName: string) {
  const trimmed = newName.trim()
  if (!trimmed || trimmed === cat.name)
    return
  emit('save', { ...cat, name: trimmed })
}

function updateCategoryLimit(cat: Category, value: string) {
  const num = value.trim() ? Number(value) : undefined
  if (cat.budgetLimit === num)
    return
  emit('save', { ...cat, budgetLimit: num && num > 0 ? num : undefined })
}

function handleAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name)
    return

  const limitNum = Number(newCategoryLimit.value)
  const budgetLimit = limitNum > 0 ? limitNum : undefined

  emit('save', {
    name,
    icon: newCategoryIcon.value || 'mdi:tag-outline',
    budgetLimit,
  })

  newCategoryName.value = ''
  newCategoryLimit.value = ''
  newCategoryIcon.value = 'mdi:tag-outline'
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Категории и лимиты бюджета"
    icon="mdi:shape-outline"
    :max-width="620"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="category-manager">
      <!-- 1. Budget Summary Card -->
      <div class="summary-card" :class="{ 'is-exceeded': isBudgetExceeded }">
        <div class="summary-top">
          <div class="summary-item">
            <span class="summary-label">Сумма всех лимитов</span>
            <div class="summary-value">
              {{ totalLimitsFormatted }}
            </div>
          </div>

          <div v-if="totalBudgetFormatted" class="summary-item right">
            <span class="summary-label">Общий бюджет поездки</span>
            <div class="summary-value secondary">
              {{ totalBudgetFormatted }}
            </div>
          </div>
        </div>

        <div v-if="totalBudget" class="budget-progress-section">
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              :class="{ exceeded: isBudgetExceeded }"
              :style="{ width: `${budgetAllocationPercent}%` }"
            />
          </div>

          <div class="budget-status-row">
            <span v-if="!isBudgetExceeded" class="status-text ok">
              <Icon icon="mdi:check-circle-outline" />
              Осталось распределить: {{ budgetDiffFormatted }}
            </span>
            <span v-else class="status-text exceeded">
              <Icon icon="mdi:alert-circle-outline" />
              Лимиты превышают общий бюджет на {{ budgetDiffFormatted }}
            </span>
            <span class="percent-text">{{ budgetAllocationPercent }}% распределено</span>
          </div>
        </div>

        <div v-else class="no-budget-hint">
          <Icon icon="mdi:information-outline" class="info-icon" />
          <span>Общий бюджет поездки рассчитывается как сумма лимитов категорий</span>
        </div>
      </div>

      <!-- 2. Search Bar (if > 4 categories) -->
      <div v-if="categories.length > 4" class="search-bar">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Быстрый поиск категории..."
          class="search-input"
        >
        <button
          v-if="searchQuery"
          type="button"
          class="clear-search-btn"
          @click="searchQuery = ''"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>

      <!-- 3. Categories List Header -->
      <div class="categories-list-header">
        <span class="col-name">Категория</span>
        <span class="col-limit">Лимит ({{ currencySymbol }})</span>
        <span class="col-actions" />
      </div>

      <!-- 4. Categories List -->
      <ul class="categories-list">
        <li
          v-for="cat in filteredCategories"
          :key="cat.id"
          class="category-item"
        >
          <!-- Icon Picker -->
          <div class="cat-icon-container" title="Нажмите, чтобы изменить иконку">
            <FinancesIconPicker
              :model-value="cat.icon"
              size="md"
              :chevron="false"
              @update:model-value="(icon: string) => emit('save', { ...cat, icon })"
            />
          </div>

          <!-- Name: readonly badge for default, inline input for custom -->
          <div class="cat-name-container">
            <div v-if="cat.isDefault" class="default-category-title">
              <span class="name-text">{{ cat.name }}</span>
              <span class="default-tag" title="Базовая системная категория">Базовая</span>
            </div>

            <input
              v-else
              :value="cat.name"
              type="text"
              placeholder="Название категории"
              class="custom-name-input"
              @change="updateCategoryName(cat, ($event.target as HTMLInputElement).value)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            >
          </div>

          <!-- Budget Limit Input -->
          <div class="cat-limit-container">
            <div class="limit-input-wrap">
              <input
                :value="cat.budgetLimit || ''"
                type="number"
                min="0"
                step="any"
                placeholder="Без лимита"
                class="limit-input"
                @change="updateCategoryLimit(cat, ($event.target as HTMLInputElement).value)"
              >
              <span class="currency-addon">{{ currencySymbol }}</span>
            </div>
          </div>

          <!-- Delete / Lock Action -->
          <div class="cat-action-container">
            <button
              v-if="!cat.isDefault"
              type="button"
              class="delete-btn"
              title="Удалить категорию"
              @click="emit('delete', cat.id)"
            >
              <Icon icon="mdi:trash-can-outline" />
            </button>
            <span
              v-else
              class="locked-icon"
              title="Базовая категория не может быть удалена"
            >
              <Icon icon="mdi:lock-outline" />
            </span>
          </div>
        </li>

        <li v-if="filteredCategories.length === 0" class="empty-search-state">
          <Icon icon="mdi:tag-off-outline" class="empty-icon" />
          <span>Категории по запросу «{{ searchQuery }}» не найдены</span>
        </li>
      </ul>

      <!-- 5. Add New Category Card -->
      <form class="new-category-card" @submit.prevent="handleAddCategory">
        <div class="new-card-header">
          <Icon icon="mdi:shape-plus" class="new-icon" />
          <span class="new-title">Новая категория</span>
        </div>

        <div class="new-category-row">
          <div class="new-icon-picker">
            <FinancesIconPicker
              v-model="newCategoryIcon"
              size="md"
              :chevron="false"
            />
          </div>

          <div class="new-name-box">
            <input
              v-model="newCategoryName"
              type="text"
              placeholder="Название (например: Сувениры, Экскурсии...)"
              required
              class="new-name-input"
            >
          </div>

          <div class="new-limit-box">
            <div class="limit-input-wrap">
              <input
                v-model.number="newCategoryLimit"
                type="number"
                min="0"
                placeholder="Лимит"
                class="limit-input"
              >
              <span class="currency-addon">{{ currencySymbol }}</span>
            </div>
          </div>

          <KitBtn
            type="submit"
            icon="mdi:plus"
            :disabled="!newCategoryName.trim()"
            class="add-btn"
          >
            Добавить
          </KitBtn>
        </div>
      </form>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.category-manager {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

// 1. Summary Card
.summary-card {
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.2s ease;

  &.is-exceeded {
    border-color: rgba(239, 68, 68, 0.4);
  }
}

.summary-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &.right {
    align-items: flex-end;
  }
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.summary-value {
  font-size: 1.35rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--fg-primary-color);

  &.secondary {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }
}

.budget-progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.progress-bar-track {
  width: 100%;
  height: 6px;
  background-color: var(--bg-primary-color);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--fg-accent-color);
  border-radius: 3px;
  transition: width 0.3s ease;

  &.exceeded {
    background-color: #ef4444;
  }
}

.budget-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;

  .status-text {
    display: flex;
    align-items: center;
    gap: 4px;

    &.ok {
      color: var(--fg-success-color, #10b981);
    }

    &.exceeded {
      color: #ef4444;
      font-weight: 600;
    }
  }

  .percent-text {
    color: var(--fg-muted-color);
    font-variant-numeric: tabular-nums;
  }
}

.no-budget-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);

  .info-icon {
    font-size: 0.95rem;
  }
}

// 2. Search Bar
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 6px 10px;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: var(--border-focus-color, var(--fg-accent-color));
  }

  .search-icon {
    font-size: 1.1rem;
    color: var(--fg-tertiary-color);
  }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.85rem;
    color: var(--fg-primary-color);

    &::placeholder {
      color: var(--fg-muted-color);
    }
  }

  .clear-search-btn {
    border: none;
    background: none;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: var(--fg-primary-color);
    }
  }
}

// 3. Categories List Header
.categories-list-header {
  display: flex;
  align-items: center;
  padding: 0 0.5rem 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-tertiary-color);
  border-bottom: 1px solid var(--border-secondary-color);

  .col-name {
    flex: 1;
    padding-left: 48px; // Icon width + gap
  }

  .col-limit {
    width: 140px;
    text-align: right;
    padding-right: 8px;
  }

  .col-actions {
    width: 32px;
  }
}

// 4. Categories List
.categories-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--r-s);
  background-color: var(--bg-tertiary-color);
  border: 1px solid transparent;
  transition: all 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--border-secondary-color);
  }
}

.cat-icon-container {
  flex-shrink: 0;
}

.cat-name-container {
  flex: 1;
  min-width: 0;
}

.default-category-title {
  display: flex;
  align-items: center;
  gap: 8px;

  .name-text {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .default-tag {
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--fg-muted-color);
    background-color: var(--bg-secondary-color);
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-secondary-color);
  }
}

.custom-name-input {
  width: 100%;
  border: 1px solid transparent;
  border-radius: var(--r-xs);
  background: transparent;
  padding: 4px 6px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  outline: none;
  transition: all 0.15s ease;

  &:hover {
    background-color: var(--bg-secondary-color);
    border-color: var(--border-secondary-color);
  }

  &:focus {
    background-color: var(--bg-secondary-color);
    border-color: var(--border-focus-color, var(--fg-accent-color));
  }
}

.cat-limit-container {
  width: 140px;
  flex-shrink: 0;
}

.limit-input-wrap {
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  padding: 0 8px;
  height: 34px;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: var(--border-focus-color, var(--fg-accent-color));
  }

  .limit-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.85rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--fg-primary-color);

    &::placeholder {
      font-weight: 400;
      color: var(--fg-muted-color);
    }

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    -moz-appearance: textfield;
  }

  .currency-addon {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-tertiary-color);
    margin-left: 4px;
    user-select: none;
  }
}

.cat-action-container {
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--r-xs);
  color: var(--fg-tertiary-color);
  font-size: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover {
    color: var(--fg-error-color, #ef4444);
    background-color: rgba(239, 68, 68, 0.1);
  }
}

.locked-icon {
  color: var(--fg-muted-color);
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.empty-search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 2rem 1rem;
  color: var(--fg-muted-color);
  font-size: 0.85rem;

  .empty-icon {
    font-size: 2rem;
  }
}

// 5. Add New Category Card
.new-category-card {
  background-color: var(--bg-tertiary-color);
  border: 1px dashed var(--border-primary-color);
  border-radius: var(--r-m);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.new-card-header {
  display: flex;
  align-items: center;
  gap: 6px;

  .new-icon {
    font-size: 1rem;
    color: var(--fg-accent-color);
  }

  .new-title {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-secondary-color);
  }
}

.new-category-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.new-icon-picker {
  flex-shrink: 0;
}

.new-name-box {
  flex: 1;
}

.new-name-input {
  width: 100%;
  height: 38px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  padding: 0 12px;
  font-size: 0.875rem;
  color: var(--fg-primary-color);
  outline: none;
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--border-focus-color, var(--fg-accent-color));
  }

  &::placeholder {
    color: var(--fg-muted-color);
  }
}

.new-limit-box {
  width: 140px;
  flex-shrink: 0;

  .limit-input-wrap {
    height: 38px;
  }
}

.add-btn {
  height: 38px;
  flex-shrink: 0;
}
</style>
