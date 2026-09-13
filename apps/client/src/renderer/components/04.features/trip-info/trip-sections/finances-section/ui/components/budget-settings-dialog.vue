<script setup lang="ts">
import type { FinancesSettings } from '../../models/types'
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  visible: boolean
  settings: FinancesSettings
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', value: FinancesSettings): void
}>()

const form = ref<FinancesSettings>({ ...props.settings })

function addRate() {
  form.value.exchangeRates[''] = 1
}

function removeRate(currency: string) {
  delete form.value.exchangeRates[currency]
}

function updateRateKey(oldKey: string, newKey: string) {
  if (oldKey === newKey || !newKey)
    return
  const value = form.value.exchangeRates[oldKey]
  delete form.value.exchangeRates[oldKey]
  form.value.exchangeRates[newKey] = value
}

watch(() => props.visible, (isVisible) => {
  if (isVisible)
    form.value = JSON.parse(JSON.stringify(props.settings))
})
</script>

<template>
  <KitDialogWithClose :visible="visible" title="Настройки финансов и бюджета" icon="mdi:cog-outline" @update:visible="emit('update:visible', $event)">
    <div class="settings-form">
      <KitInput v-model="form.mainCurrency" label="Основная валюта" placeholder="RUB, USD..." />

      <div class="budget-input-wrapper">
        <KitInput
          :model-value="form.totalBudget ? String(form.totalBudget) : ''"
          label="Общий бюджет поездки"
          placeholder="Например: 200000"
          type="number"
          @update:model-value="form.totalBudget = $event ? Number($event) : undefined"
        />
        <div class="budget-hint">
          Если не указан, общий бюджет рассчитывается автоматически как сумма лимитов категорий или сумма запланированных трат.
        </div>
      </div>

      <div class="rates-section">
        <label>Курсы валют (по отношению к основной)</label>
        <div v-for="currency in Object.keys(form.exchangeRates)" :key="currency" class="rate-item">
          <KitInput :model-value="currency" placeholder="USD" @update:model-value="updateRateKey(currency, $event as string)" />
          <span>=</span>
          <KitInput v-model="form.exchangeRates[currency]" type="number" placeholder="90" />
          <button class="delete-btn" title="Удалить курс" @click="removeRate(currency)">
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </div>
        <KitBtn variant="text" icon="mdi:plus" @click="addRate">
          Добавить валюту
        </KitBtn>
      </div>

      <div class="form-actions">
        <KitBtn variant="text" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn @click="emit('save', form)">
          Сохранить
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.budget-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  .budget-hint {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    line-height: 1.35;
  }
}

.rates-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.rate-item {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--r-s);
  color: var(--fg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  transition: color 0.15s ease;

  &:hover {
    color: var(--fg-error-color);
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
