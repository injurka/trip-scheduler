<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { TripsHubKey } from '../../composables/use-trips-hub'
import StepBasicInfo from './step-basic-info.vue'

const tripsHub = inject(TripsHubKey)

if (!tripsHub)
  throw new Error('TripsHub logic was not provided.')

const isFormValid = computed(() => {
  return tripsHub.newTripData.value.title.trim().length > 0
})
</script>

<template>
  <KitDialogWithClose
    v-model:visible="tripsHub.isCreateModalOpen.value"
    title="Новое путешествие"
    icon="mdi:compass-outline"
    :max-width="500"
  >
    <div class="create-trip-flow">
      <StepBasicInfo v-model="tripsHub.newTripData.value" />

      <div class="flow-actions">
        <KitBtn
          variant="outlined"
          color="secondary"
          @click="tripsHub.closeCreateModal"
        >
          Отмена
        </KitBtn>
        <KitBtn
          :disabled="!isFormValid || tripsHub.isCreating.value"
          :loading="tripsHub.isCreating.value"
          @click="tripsHub.createTrip"
        >
          Создать
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style lang="scss" scoped>
.create-trip-flow {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.flow-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
