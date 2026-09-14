<script setup lang="ts">
import BookingPhotos from './booking-photos.vue'

interface Props {
  photos?: string[]
  readonly: boolean
  tripId?: string
}

const props = withDefaults(defineProps<Props>(), {
  photos: () => [],
  tripId: '',
})

const emit = defineEmits<{
  (e: 'update:photos', value: string[]): void
}>()
</script>

<template>
  <BookingPhotos
    :photos="props.photos"
    :readonly="props.readonly"
    :trip-id="props.tripId"
    title="Фотографии отеля"
    icon="mdi:camera-outline"
    @update:photos="emit('update:photos', $event)"
  />
</template>
