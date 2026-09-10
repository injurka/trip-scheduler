<script setup lang="ts">
import type { BookingKindMeta } from '../../models/booking-kinds'
import { Icon } from '@iconify/vue'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import BookingKindBadge from './booking-kind-badge.vue'

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
  <div class="booking-kind-field">
    <KitSelectWithSearch
      v-if="!readonly"
      :model-value="selectedValue"
      :items="items"
      :label="label || 'Тип'"
      :icon="icon || 'mdi:tag-outline'"
      placeholder="Не указано"
      size="sm"
      @update:model-value="onUpdate"
    />

    <template v-else>
      <span class="field-label">
        <Icon :icon="icon || 'mdi:tag-outline'" />
        <span>{{ label || 'Тип' }}</span>
      </span>
      <BookingKindBadge v-if="selectedMeta" :meta="selectedMeta" size="md" />
      <span v-else class="empty-value">Не указано</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
.booking-kind-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  .field-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
  }

  .empty-value {
    font-size: 0.85rem;
    color: var(--fg-tertiary-color);
    font-style: italic;
  }
}
</style>
