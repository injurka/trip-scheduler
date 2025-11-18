<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { FinancesSettings, Transaction } from '../../models/types'
import { Icon } from '@iconify/vue'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitFileInput } from '~/components/01.kit/kit-file-input'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { useRequest, useRequestStatus } from '~/plugins/request'

interface FinancesCategory {
  id: string
  name: string
  icon: string
  isDefault?: boolean
}

type CreatorState = 'input' | 'loading' | 'preview' | 'error'

type GeneratedTransaction = Omit<Transaction, 'id' | 'categoryId'> & {
  categorySuggestion?: string
  categoryId: string | null
}

const props = defineProps<{
  categories: FinancesCategory[]
  settings: FinancesSettings
}>()

const emit = defineEmits<{
  (e: 'save', transactions: Partial<Transaction>[]): void
  (e: 'close'): void
}>()

const state = ref<CreatorState>('input')
const error = ref<string | null>(null)
const userInput = ref('')
const generatedTransactions = ref<GeneratedTransaction[]>([])
const uploadedFile = ref<File | null>(null)

const GENERATE_FINANCES_KEY = 'finances:generate'
const isLoading = useRequestStatus(GENERATE_FINANCES_KEY)

const categoryOptions = computed(() => {
  return props.categories.map(cat => ({
    label: cat.name,
    value: cat.id,
    icon: cat.icon,
  }))
})

const currencyOptions = computed(() => {
  const currencies = new Set([props.settings.mainCurrency, ...Object.keys(props.settings.exchangeRates)])
  return Array.from(currencies).map(c => ({
    label: c,
    value: c,
  }))
})

function getCategoryIcon(categoryId: string | null): string {
  if (!categoryId)
    return 'mdi:shape-outline'

  const category = props.categories.find(c => c.id === categoryId)

  return category?.icon || 'mdi:shape-outline'
}

function resetState() {
  state.value = 'input'
  error.value = null
  userInput.value = ''
  uploadedFile.value = null
  generatedTransactions.value = []
}

async function handleGenerate() {
  if (!userInput.value.trim() && !uploadedFile.value) {
    useToast().error('Пожалуйста, введите описание или прикрепите файл.')
    return
  }
  state.value = 'loading'
  error.value = null

  try {
    const formData = new FormData()
    formData.append('text', userInput.value)
    if (uploadedFile.value)
      formData.append('file', uploadedFile.value)

    const response = await useRequest<Omit<GeneratedTransaction, 'categoryId'>[]>({
      key: GENERATE_FINANCES_KEY,
      fn: db => db.llm.generateFinancesFromData(formData),
    })

    if (!response || response.length === 0)
      throw new Error('Не удалось распознать траты. Попробуйте переформулировать запрос или использовать другое изображение.')

    const availableCurrencies = new Set([props.settings.mainCurrency, ...Object.keys(props.settings.exchangeRates)])

    generatedTransactions.value = response.map((tx) => {
      const foundCategory = props.categories.find(cat => cat.name === tx.categorySuggestion)
      const otherCategory = props.categories.find(cat => cat.isDefault && cat.name === 'Прочее')

      const suggestedCurrency = tx.currency ? tx.currency.toUpperCase() : ''
      const finalCurrency = availableCurrencies.has(suggestedCurrency)
        ? suggestedCurrency
        : props.settings.mainCurrency

      return {
        ...tx,
        currency: finalCurrency,
        date: tx.date || today(getLocalTimeZone()).toString(), // Установка сегодняшней даты, если она отсутствует
        categoryId: foundCategory ? foundCategory.id : (otherCategory ? otherCategory.id : null),
      }
    })

    state.value = 'preview'
  }
  catch (e: any) {
    console.error('AI finances generation failed:', e)
    error.value = e.message || 'Произошла ошибка. Пожалуйста, попробуйте еще раз.'
    state.value = 'error'
  }
}

function handleSave() {
  if (generatedTransactions.value.length > 0) {
    const transactionsToSave = generatedTransactions.value.map(tx => ({
      title: tx.title,
      amount: tx.amount,
      currency: tx.currency,
      date: tx.date,
      notes: tx.notes,
      categoryId: tx.categoryId,
    }))
    emit('save', transactionsToSave)
    resetState()
  }
}

function getCalendarDate(tx: GeneratedTransaction): CalendarDate | null {
  try {
    return tx.date ? parseDate(tx.date) : null
  }
  catch {
    return null
  }
}

function updateTransactionDate(tx: GeneratedTransaction, newDate: CalendarDate | null) {
  tx.date = newDate ? newDate.toString() : undefined
}
</script>

<template>
  <div class="ai-creator-content">
    <!-- INPUT STATE -->
    <div v-if="state === 'input' || state === 'error'" class="input-view">
      <p class="description">
        <Icon icon="mdi:information-outline" />
        <span>Вставьте (Ctrl+V) изображение, прикрепите файл (например, чек) или опишите траты текстом.</span>
      </p>
      <KitFileInput v-model="uploadedFile" accept=".png,.jpg,.jpeg">
        <template #default>
          Нажмите, чтобы выбрать файл, или вставьте изображение
        </template>
        <template #supported-formats>
          Поддерживаются: .png, .jpg, .jpeg
        </template>
      </KitFileInput>
      <KitInput
        v-model="userInput"
        type="textarea"
        label="Дополнительное описание (необязательно)"
        placeholder="Здесь можно добавить контекст к файлу или описать траты вручную..."
        :rows="3"
      />
      <div v-if="state === 'error' && error" class="error-message">
        <Icon icon="mdi:alert-circle-outline" />
        <span>{{ error }}</span>
      </div>
      <div class="dialog-actions">
        <KitBtn variant="text" @click="$emit('close')">
          Отмена
        </KitBtn>
        <KitBtn :disabled="(!userInput.trim() && !uploadedFile) || isLoading" :loading="isLoading" @click="handleGenerate">
          Распознать
        </KitBtn>
      </div>
    </div>

    <!-- LOADING STATE -->
    <div v-if="state === 'loading'" class="loading-view">
      <Icon icon="svg-spinners:3-dots-fade" />
      <p>Анализирую данные...</p>
      <span>Это может занять несколько секунд.</span>
    </div>

    <!-- PREVIEW STATE -->
    <div v-if="state === 'preview' && generatedTransactions.length > 0" class="preview-view">
      <p class="description">
        <Icon icon="mdi:check-circle-outline" />
        <span>Проверьте и при необходимости исправьте распознанные данные.</span>
      </p>
      <div class="preview-list">
        <div v-for="(tx, index) in generatedTransactions" :key="index" class="preview-item">
          <div class="pi-icon-wrapper">
            <Icon :icon="getCategoryIcon(tx.categoryId)" class="pi-category-icon" />
          </div>

          <div class="pi-content">
            <div class="pi-row">
              <div class="pi-input-group pi-title-group">
                <Icon icon="mdi:text-box-outline" class="pi-input-icon" />
                <KitInput v-model="tx.title" placeholder="Название траты..." size="sm" class="pi-title" />
              </div>

              <div class="pi-input-group pi-amount-currency">
                <Icon icon="mdi:cash" class="pi-input-icon pi-ac-icon" />
                <KitInput v-model.number="tx.amount" placeholder="0" type="number" size="sm" class="pi-amount" />
                <span class="pi-ac-separator" />
                <KitSelectWithSearch
                  v-model="tx.currency"
                  :items="currencyOptions"
                  placeholder="Валюта"
                  size="sm"
                  class="pi-currency"
                />
              </div>
            </div>

            <div class="pi-row">
              <div class="pi-input-group pi-category-group">
                <Icon icon="mdi:shape-outline" class="pi-input-icon" />
                <KitSelectWithSearch
                  v-model="tx.categoryId"
                  size="sm"
                  :items="categoryOptions"
                  placeholder="Выберите категорию"
                  class="pi-category"
                />
              </div>

              <CalendarPopover
                :model-value="getCalendarDate(tx)"
                clearable
                @update:model-value="updateTransactionDate(tx, $event)"
              >
                <template #trigger>
                  <button class="pi-date-trigger">
                    <Icon icon="mdi:calendar-blank-outline" />
                    <span>{{ tx.date ? formatDate(tx.date, { dateStyle: 'medium' }) : 'Нет даты' }}</span>
                  </button>
                </template>
              </CalendarPopover>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <KitBtn variant="text" @click="resetState">
          <Icon icon="mdi:arrow-left" />
          Назад
        </KitBtn>
        <KitBtn @click="handleSave">
          <Icon icon="mdi:check-all" />
          Добавить траты
        </KitBtn>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-creator-content {
  display: flex;
  flex-direction: column;
}

.input-view,
.preview-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.description {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
  margin: 0;

  .iconify {
    font-size: 1.1rem;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);

  .kit-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
}

.loading-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  gap: 1rem;
  color: var(--fg-secondary-color);
  min-height: 250px;

  .iconify {
    font-size: 3rem;
  }

  p {
    font-size: 1.1rem;
    font-weight: 500;
  }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-error-color);
  color: var(--fg-error-color);
  padding: 0.75rem 1rem;
  border-radius: var(--r-s);
  font-size: 0.9rem;

  .iconify {
    font-size: 1.2rem;
  }
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 4px;
  margin: -4px;
}

.preview-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  background-color: var(--bg-tertiary-color);
  padding: 1rem;
  border-radius: var(--r-m);
  border: 1px solid transparent;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.pi-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  background-color: var(--bg-accent-color);
  border-radius: var(--r-full);
  border: 1px solid var(--border-secondary-color);
  margin-top: 4px;

  .pi-category-icon {
    font-size: 1.5rem;
    color: var(--fg-accent-color);
  }
}

.pi-content {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 0.75rem;
  width: 100%;
}

.pi-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.pi-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  border-bottom: 1px solid var(--border-secondary-color);
  transition: border-color 0.2s ease;

  &:focus-within {
    border-color: var(--border-focus-color);
  }
}

.pi-input-icon {
  font-size: 1.2rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.pi-title-group {
  flex-grow: 1;
}

.pi-category-group {
  flex-grow: 1;
}

.pi-title {
  :deep(input) {
    font-weight: 600;
    font-size: 1rem;
  }
}

.pi-amount-currency {
  justify-self: flex-end;
  width: auto;
  min-width: 150px;

  .pi-ac-icon {
    font-size: 1.3rem;
  }

  .pi-amount {
    :deep(input) {
      font-size: 1.1rem;
      font-weight: 700;
      text-align: right;
      width: 90px;
    }
  }

  .pi-ac-separator {
    width: 1px;
    height: 16px;
    background-color: var(--border-secondary-color);
  }
}

.pi-category,
.pi-currency {
  :deep(.main-icon) {
    display: none;
  }
  :deep(.search-input) {
    font-size: 0.9rem;
  }
  :deep(.chip-input-wrapper) {
    padding-left: 0;
  }
}

.pi-currency {
  :deep(.chip-input-wrapper) {
    min-width: 65px;
  }
  :deep(.search-input) {
    text-align: left;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.pi-date-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  background-color: transparent;
  padding: 4px 8px;
  border-radius: var(--r-s);
  justify-self: flex-end;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
  }
}

.preview-item {
  :deep(label) {
    display: none;
  }

  :deep(input),
  :deep(.kit-select-with-search .chip-input-wrapper) {
    background-color: transparent !important;
    border: none !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    height: auto !important;
    min-height: 36px !important;
    box-shadow: none !important;

    &:focus-within,
    &:focus {
      box-shadow: none !important;
    }
  }
}

@include media-down(md) {
  .preview-item {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .pi-icon-wrapper {
    width: 40px;
    height: 40px;
    margin-top: 0;

    .pi-category-icon {
      font-size: 1.3rem;
    }
  }

  .pi-content {
    gap: 1rem;
  }

  .pi-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .pi-amount-currency {
    width: 100%;
    min-width: unset;
  }

  .pi-date-trigger {
    width: 100%;
    justify-self: stretch;
    justify-content: center;
    padding: 0.5rem;
    background-color: var(--bg-secondary-color);
    border-radius: var(--r-m);

    &:hover {
      background-color: var(--bg-hover-color);
    }
  }

  .pi-input-group {
    border-bottom: none;
  }
}
</style>
