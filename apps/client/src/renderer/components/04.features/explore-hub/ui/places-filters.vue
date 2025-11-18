<script setup lang="ts">
import type { PlaceTag } from '~/shared/types/models/place'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'

defineProps<{
  tags: PlaceTag[]
  selectedTagIds: string[]
}>()

const emit = defineEmits<{
  (e: 'toggleTag', tagId: string): void
}>()
</script>

<template>
  <div class="filters-content">
    <KitCheckbox
      v-for="tag in tags"
      :key="tag.id"
      :model-value="selectedTagIds.includes(tag.id)"
      @update:model-value="emit('toggleTag', tag.id)"
    >
      {{ tag.name }}
    </KitCheckbox>
  </div>
</template>

<style scoped lang="scss">
.filters-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
