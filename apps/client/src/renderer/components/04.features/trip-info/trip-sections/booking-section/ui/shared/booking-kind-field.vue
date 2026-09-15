<script setup lang="ts">
import type { BookingKindMeta } from '../../models/booking-kinds'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import BookingField from './booking-field.vue'

const props = defineProps<{
  /** Текущее значение пометки. */
  modelValue?: string
  /** Доступные пометки для типа бронирования. */
  options: BookingKindMeta[]
  readonly: boolean
  label?: string
  icon?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string | undefined): void }>()

const items = computed(() => props.options.map(option => ({
  value: option.value,
  label: option.label,
  icon: option.icon,
})))

const selectedMeta = computed(() => props.options.find(option => option.value === props.modelValue) || null)

const selectedValue = computed<string | null>(() => props.modelValue || null)

function onUpdate(value: string | string[] | null) {
  emit('update:modelValue', typeof value === 'string' ? value : undefined)
}
</script>

<template>
  <BookingField
    v-if="readonly"
    :model-value="selectedMeta?.label"
    :label="label || 'Тип'"
    :icon="selectedMeta?.icon || icon || 'mdi:tag-outline'"
    :readonly="true"
  />

  <div v-else class="booking-kind-field">
    <KitSelectWithSearch
      :model-value="selectedValue"
      :items="items"
      :label="label || 'Тип'"
      :icon="icon || 'mdi:tag-outline'"
      placeholder="Не указано"
      size="sm"
      @update:model-value="onUpdate"
    />
  </div>
</template>

<style scoped lang="scss">
.booking-kind-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
</style>
