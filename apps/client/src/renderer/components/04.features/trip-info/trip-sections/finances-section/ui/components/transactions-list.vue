<script setup lang="ts">
import type { Category, FinancesSettings, Transaction } from '../../models/types'
import { Icon } from '@iconify/vue'
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

function getCategory(id: string | null, categories: Category[]) {
  return categories.find(c => c.id === id)
}
const { format: formatCurrency } = useCurrencyFormatter()

function getConvertedAmountInMainCurrency(transaction: Transaction): string | null {
  // Check if currency is the same as main, if so, no need to convert
  if (transaction.currency === props.settings.mainCurrency)
    return null

  const rate = props.settings.exchangeRates[transaction.currency] || 1
  const convertedAmount = transaction.amount * rate
  return formatCurrency(convertedAmount, props.settings.mainCurrency)
}
</script>

<template>
  <div class="transactions-wrapper">
    <header class="list-header">
      <h3>Все траты</h3>
      <div v-if="filteredTotal > 0" class="total-amount">
        <span>Потрачено:</span>
        <strong>{{ formatCurrency(filteredTotal, settings.mainCurrency) }}</strong>
      </div>
    </header>
    <div v-if="transactions.length > 0" class="transactions-list">
      <template v-for="(tx, index) in transactions" :key="tx.id">
        <div
          v-if="index > 0 && !transactions[index - 1].date && tx.date"
          class="list-divider"
        >
          <span>Траты по дням</span>
        </div>
        <div class="transaction-item">
          <div class="item-main">
            <div class="item-icon">
              <Icon :icon="getCategory(tx.categoryId, categories)?.icon || 'mdi:help-rhombus-outline'" />
            </div>
            <div class="item-details">
              <span class="item-title">{{ tx.title }}</span>
              <span class="item-category">
                {{ getCategory(tx.categoryId, categories)?.name || 'Без категории' }}
                <template v-if="tx.date">
                  • {{ formatDate(tx.date, { dateStyle: 'medium' }) }}
                </template>
              </span>
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
              <button title="Редактировать" @click="emit('editTransaction', tx)">
                <Icon icon="mdi:pencil-outline" />
              </button>
              <button title="Удалить" @click="emit('deleteTransaction', tx.id)">
                <Icon icon="mdi:trash-can-outline" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
    <div v-else class="empty-state">
      <Icon icon="mdi:receipt-text-outline" />
      <p>Трат пока нет. Начните учет, добавив первую запись.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  height: 32px;

  h3 {
    margin: 0;
  }

  .total-amount {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    background-color: var(--bg-secondary-color);
    padding: 4px 10px;
    border-radius: var(--r-s);
    strong {
      color: var(--fg-error-color);
      font-weight: 600;
    }
  }
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-top: 1px solid var(--border-secondary-color);
}

.item-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.item-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
}

.item-details {
  display: flex;
  flex-direction: column;
}
.item-title {
  font-weight: 500;
}
.item-category {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.item-amount {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.amount-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
.original-amount {
  font-weight: 500;
  font-size: 1rem;
  color: var(--fg-error-color);
}
.converted-amount {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--fg-tertiary-color);
}

.item-actions {
  display: flex;
  gap: 0.5rem;
  transition: opacity 0.2s;
  button {
    color: var(--fg-tertiary-color);
  }
  button:hover {
    color: var(--fg-primary-color);
  }
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--fg-tertiary-color);
  font-size: 2.5rem;
  p {
    font-size: 0.9rem;
  }
}

.list-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 1rem 0 1.5rem;
  color: var(--fg-tertiary-color);
  font-size: 0.8rem;
  font-weight: 500;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--border-secondary-color);
  }

  span {
    padding: 0 0.5rem;
  }
}

@include media-down(sm) {
  .transaction-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  .item-amount {
    justify-content: space-between;
    gap: 1rem;
    padding-left: calc(40px + 1rem);
  }
  .item-actions {
    opacity: 1;
    gap: 1rem;
  }
}
</style>
