<script setup lang="ts">
import type { ITrip } from '../../models/types'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import TripListEmpty from './states/trip-list-empty.vue'
import TripListSkeleton from './states/trip-list-skeleton.vue'
import TripCard from './trip-card/card-item.vue'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'retry'): void
}>()

interface Props {
  isLoading: boolean
  error: unknown | null
  trips: ITrip[]
  hasLoadedOnce: boolean
}

const displayData = computed(() => (props.trips.length > 0 ? props.trips : null))
const transitionName = computed(() => (props.hasLoadedOnce ? 'fade' : 'slide-up'))
</script>

<template>
  <AsyncStateWrapper
    :loading="isLoading"
    :error="error"
    :data="displayData"
    :retry-handler="() => emit('retry')"
    :transition="transitionName"
    class="trip-list-wrapper"
  >
    <template #loading>
      <TripListSkeleton />
    </template>

    <template #success="{ data }">
      <TripCard
        v-for="trip in data"
        :key="trip.id"
        :="trip"
      />
    </template>

    <template #empty>
      <TripListEmpty />
    </template>
  </AsyncStateWrapper>
</template>

<style lang="scss" scoped>
.trip-list-wrapper {
  height: 100%;
}
</style>
