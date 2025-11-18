<script setup lang="ts">
import type { useTripPlanStore } from '~/components/04.features/trip-info/trip-plan'
import type { useTripSectionsStore } from '~/components/05.modules/trip-info/store/trip-info-sections.store'
import { TripOverview } from '~/components/04.features/trip-info/trip-overview'

interface Props {
  plan: ReturnType<typeof useTripPlanStore>
  sections: ReturnType<typeof useTripSectionsStore>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'edit'): void
}>()

function handleDeleteTrip() {
  props.plan.deleteCurrentTrip()
}
</script>

<template>
  <TripOverview
    :trip="plan.trip"
    :sections="sections.sortedSections"
    :days="plan.days"
    class="trip-overview"
    @edit="emit('edit')"
    @delete="handleDeleteTrip"
  />
</template>

<style scoped lang="scss">
.trip-overview {
  padding: 1rem 0;
}
</style>
