<script setup lang="ts">
import { TrackingControlCard } from '~/components/05.modules/activity-tracking'

const emit = defineEmits<{
  (e: 'changed', running: boolean): void
}>()
</script>

<template>
  <TrackingControlCard @changed="emit('changed', $event)" />
</template>
