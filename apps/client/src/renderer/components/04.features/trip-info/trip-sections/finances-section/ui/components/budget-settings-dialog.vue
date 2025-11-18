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
  <KitDialogWithClose :visible="visible" title="Настройки финансов" icon="mdi:cog-outline" @update:visible="emit('update:visible', $event)">
    <div class="settings-form">
      <KitInput v-model="form.mainCurrency" label="Основная валюта" placeholder="RUB, USD..." />

      <div class="rates-section">
        <label>Курсы валют (по отношению к основной)</label>
        <div v-for="currency in Object.keys(form.exchangeRates)" :key="currency" class="rate-item">
          <KitInput :model-value="currency" placeholder="USD" @update:model-value="updateRateKey(currency, $event as string)" />
          <span>=</span>
          <KitInput v-model="form.exchangeRates[currency]" type="number" placeholder="90" />
          <button class="delete-btn" @click="removeRate(currency)">
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
  color: var(--fg-tertiary-color);
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
