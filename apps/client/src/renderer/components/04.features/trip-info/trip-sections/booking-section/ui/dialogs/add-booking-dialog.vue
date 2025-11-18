<script setup lang="ts">
import type { BOOKING_TYPES_CONFIG } from '../../composables'
import type { BookingType } from '../../models/types'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'

defineProps<{
  bookingTypeConfigs: typeof BOOKING_TYPES_CONFIG
}>()

const emit = defineEmits<{
  (e: 'add', type: BookingType): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

function handleAddClick(type: BookingType) {
  emit('add', type)
}

function formatAddButtonLabel(label: string): string {
  const words = label.toLowerCase().split(' ')
  const lastWord = words[words.length - 1]

  if (lastWord.endsWith('ы')) {
    words[words.length - 1] = lastWord.slice(0, -1)
  }
  else if (lastWord.endsWith('а')) {
    words[words.length - 1] = `${lastWord.slice(0, -1)}о`
  }
  return `Добавить ${words.join(' ')}`
}
</script>

<template>
  <KitDialogWithClose
    v-model:visible="visible"
    title="Добавить бронирование"
    icon="mdi:plus-circle-outline"
    :max-width="600"
  >
    <div class="add-booking-dialog-content">
      <p class="description">
        Выберите, что вы хотите добавить в свое путешествие.
      </p>
      <div class="buttons-grid">
        <KitBtn
          v-for="(config, type) in bookingTypeConfigs"
          :key="type"
          :icon="config.icon"
          variant="outlined"
          color="secondary"
          @click="handleAddClick(type)"
        >
          {{ formatAddButtonLabel(config.label) }}
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.add-booking-dialog-content {
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.description {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  text-align: center;
  margin: 0;
}

.buttons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}
</style>
