<script setup lang="ts">
import type { Category, FinancesSettings, Transaction } from '../../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useCurrencyFormatter } from '../../composables/use-currency-formatter'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  settings: FinancesSettings
  readonly: boolean
  filteredTotal: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'editTransaction', transaction: Transaction): void
  (e: 'deleteTransaction', id: string): void
}>()

const { format: formatCurrency } = useCurrencyFormatter()
const searchQuery = ref('')

function getCategory(id: string | null, categories: Category[]) {
  return categories.find(c => c.id === (id || 'cat-other'))
}

function getConvertedAmountInMainCurrency(transaction: Transaction): string | null {
  if (transaction.currency === props.settings.mainCurrency)
    return null

  const rate = props.settings.exchangeRates[transaction.currency] || 1
  const convertedAmount = transaction.amount * rate
  return formatCurrency(convertedAmount, props.settings.mainCurrency)
}

function getAmountInMainCurrency(transaction: Transaction): number {
  if (transaction.currency === props.settings.mainCurrency)
    return transaction.amount
  const rate = props.settings.exchangeRates[transaction.currency] || 1
  return transaction.amount * rate
}

function getTxWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 19)
    return 'трат'
  if (mod10 === 1)
    return 'трата'
  if (mod10 >= 2 && mod10 <= 4)
    return 'траты'
  return 'трат'
}

const searchedTransactions = computed(() => {
  if (!searchQuery.value.trim())
    return props.transactions

  const query = searchQuery.value.trim().toLowerCase()
  return props.transactions.filter((tx) => {
    const titleMatch = tx.title.toLowerCase().includes(query)
    const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(query) : false
    const catName = getCategory(tx.categoryId, props.categories)?.name.toLowerCase() || ''
    const catMatch = catName.includes(query)
    return titleMatch || notesMatch || catMatch
  })
})

interface DayGroup {
  dateKey: string
  dateFormatted: string
  dayOfWeek: string
  totalInMainCurrency: number
  transactions: Transaction[]
}

const groupedTransactions = computed<DayGroup[]>(() => {
  const groupsMap = new Map<string, {
    dateKey: string
    dateFormatted: string
    dayOfWeek: string
    total: number
    items: Transaction[]
  }>()

  for (const tx of searchedTransactions.value) {
    const key = tx.date ? tx.date.split('T')[0] : 'no-date'

    if (!groupsMap.has(key)) {
      let dateFormatted = 'Без даты'
      let dayOfWeek = ''

      if (tx.date) {
        const d = new Date(tx.date)
        dateFormatted = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        const rawWd = d.toLocaleDateString('ru-RU', { weekday: 'short' })
        dayOfWeek = rawWd.charAt(0).toUpperCase() + rawWd.slice(1)
      }

      groupsMap.set(key, {
        dateKey: key,
        dateFormatted,
        dayOfWeek,
        total: 0,
        items: [],
      })
    }

    const group = groupsMap.get(key)!
    group.items.push(tx)
    group.total += getAmountInMainCurrency(tx)
  }

  return Array.from(groupsMap.values()).map(g => ({
    dateKey: g.dateKey,
    dateFormatted: g.dateFormatted,
    dayOfWeek: g.dayOfWeek,
    totalInMainCurrency: g.total,
    transactions: g.items,
  }))
})

const totalSearchedAmount = computed(() => {
  return searchedTransactions.value.reduce((sum, tx) => sum + getAmountInMainCurrency(tx), 0)
})
</script>

<template>
  <div class="transactions-wrapper">
    <header class="list-header">
      <div class="header-left">
        <h3>Все траты</h3>
        <span class="count-badge">{{ searchedTransactions.length }}</span>
      </div>

      <div class="header-actions">
        <div class="search-wrap">
          <KitInput
            v-model="searchQuery"
            placeholder="Поиск по названию или категории..."
            icon="mdi:magnify"
            size="sm"
          >
            <template v-if="searchQuery" #append>
              <button class="clear-search-btn" title="Очистить" @click="searchQuery = ''">
                <Icon icon="mdi:close-circle" />
              </button>
            </template>
          </KitInput>
        </div>

        <div v-if="filteredTotal > 0" class="total-amount">
          <span>Потрачено:</span>
          <strong>{{ formatCurrency(searchQuery ? totalSearchedAmount : filteredTotal, settings.mainCurrency) }}</strong>
        </div>
      </div>
    </header>

    <div v-if="groupedTransactions.length > 0" class="groups-container">
      <div
        v-for="group in groupedTransactions"
        :key="group.dateKey"
        class="day-group"
      >
        <div class="day-group-header">
          <div class="day-group-info">
            <span class="day-date">{{ group.dateFormatted }}</span>
            <span v-if="group.dayOfWeek" class="day-weekday">{{ group.dayOfWeek }}</span>
            <span class="day-count">{{ group.transactions.length }} {{ getTxWord(group.transactions.length) }}</span>
          </div>
          <div class="day-group-total">
            <span class="day-total-label">За день:</span>
            <span class="day-total-val">{{ formatCurrency(group.totalInMainCurrency, settings.mainCurrency) }}</span>
          </div>
        </div>

        <div class="day-items-list">
          <div
            v-for="tx in group.transactions"
            :key="tx.id"
            class="transaction-item"
          >
            <div class="item-main">
              <div class="item-icon" :class="{ 'is-spontaneous': tx.isSpontaneous }">
                <Icon :icon="getCategory(tx.categoryId, categories)?.icon || 'mdi:help-rhombus-outline'" />
              </div>
              <div class="item-details">
                <div class="item-title-row">
                  <span class="item-title">{{ tx.title }}</span>
                  <KitTooltip v-if="tx.isSpontaneous" text="Спонтанная/дополнительная трата">
                    <span class="spontaneous-badge">
                      <Icon icon="mdi:sparkles" />
                      <span>Спонтанно</span>
                    </span>
                  </KitTooltip>
                </div>
                <div class="item-meta-row">
                  <span class="item-category">
                    {{ getCategory(tx.categoryId, categories)?.name || 'Без категории' }}
                  </span>
                  <span v-if="tx.notes" class="item-notes" :title="tx.notes">
                    • {{ tx.notes }}
                  </span>
                </div>
              </div>
            </div>

            <div class="item-amount">
              <div class="amount-group">
                <span class="original-amount">
                  -{{ formatCurrency(tx.amount, tx.currency) }}
                </span>
                <span v-if="tx.currency !== settings.mainCurrency" class="converted-amount">
                  ~{{ getConvertedAmountInMainCurrency(tx) }}
                </span>
              </div>
              <div v-if="!readonly" class="item-actions">
                <KitBtn
                  icon="mdi:pencil-outline"
                  variant="text"
                  color="secondary"
                  size="sm"
                  title="Редактировать"
                  @click="emit('editTransaction', tx)"
                />
                <KitBtn
                  icon="mdi:trash-can-outline"
                  variant="text"
                  color="secondary"
                  size="sm"
                  title="Удалить"
                  @click="emit('deleteTransaction', tx.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="searchQuery" class="empty-search-state">
      <Icon icon="mdi:database-search-outline" />
      <p>Ничего не найдено по запросу «{{ searchQuery }}»</p>
      <KitBtn size="sm" variant="tonal" @click="searchQuery = ''">
        Сбросить поиск
      </KitBtn>
    </div>

    <div v-else class="empty-state">
      <Icon icon="mdi:receipt-text-outline" />
      <p>Трат пока нет. Начните учет, добавив первую запись.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.transactions-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .count-badge {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-secondary-color);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      font-family: var(--font-mono);
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .search-wrap {
    min-width: 240px;
    display: flex;
    align-items: center;

    :deep(.kit-input-group) {
      margin: 0;
      gap: 0;
    }

    :deep(.kit-input-wrapper) {
      height: 38px;
    }

    :deep(input) {
      height: 38px;
      min-height: 38px;
      box-sizing: border-box;
    }
  }

  .clear-search-btn {
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    transition: color 0.15s ease;

    &:hover {
      color: var(--fg-primary-color);
    }
  }

  .total-amount {
    display: inline-flex;
    align-items: center;
    height: 38px;
    box-sizing: border-box;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 0 12px;
    border-radius: var(--r-s);
    white-space: nowrap;

    strong {
      color: var(--fg-error-color);
      font-weight: 700;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }
  }
}

.groups-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.day-group {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  overflow: hidden;
}

.day-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 1rem;
  background-color: var(--bg-tertiary-color);
  border-bottom: 1px solid var(--border-secondary-color);

  .day-group-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .day-date {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .day-weekday {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--fg-accent-color, #e16032);
    background-color: color-mix(in srgb, var(--fg-accent-color, #e16032) 12%, transparent);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .day-count {
    font-size: 0.75rem;
    color: var(--fg-tertiary-color);
  }

  .day-group-total {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;

    .day-total-label {
      color: var(--fg-secondary-color);
    }

    .day-total-val {
      font-weight: 700;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      color: var(--fg-primary-color);
    }
  }
}

.day-items-list {
  display: flex;
  flex-direction: column;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 1rem;
  border-top: 1px solid var(--border-secondary-color);
  transition: background-color 0.15s ease;

  &:first-child {
    border-top: none;
  }

  &:hover {
    background-color: color-mix(in srgb, var(--bg-primary-color) 60%, transparent);

    .item-actions {
      opacity: 1;
    }
  }
}

.item-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.item-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  flex-shrink: 0;

  &.is-spontaneous {
    color: #bd10e0;
    background-color: color-mix(in srgb, #bd10e0 12%, transparent);
    border: 1px dashed color-mix(in srgb, #bd10e0 40%, transparent);
  }
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spontaneous-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #9333ea;
  background-color: color-mix(in srgb, #bd10e0 12%, transparent);
  padding: 1px 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.item-meta-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--fg-secondary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-category {
  color: var(--fg-secondary-color);
}

.item-notes {
  color: var(--fg-tertiary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: italic;
}

.item-amount {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

.amount-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.original-amount {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--fg-error-color);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.converted-amount {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.item-actions {
  display: flex;
  gap: 0.15rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.empty-state,
.empty-search-state {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--fg-tertiary-color);
  font-size: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  p {
    font-size: 0.9rem;
    margin: 0;
  }
}

@include media-down(sm) {
  .list-header {
    flex-direction: column;
    align-items: stretch;

    .header-actions {
      flex-direction: column;
      align-items: stretch;

      .search-wrap {
        width: 100%;
      }
    }
  }

  .transaction-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }

  .item-amount {
    justify-content: space-between;
    padding-left: calc(36px + 0.85rem);
  }

  .item-actions {
    opacity: 1;
  }
}
</style>
