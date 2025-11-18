<script setup lang="ts">
import { useLastCounts } from '~/shared/composables/use-last-counts'
import TripCardSkeleton from '../trip-card/card-skeleton.vue'

const { getCount } = useLastCounts()

const count = computed(() => getCount('trip-list', 3))
</script>

<template>
  <TripCardSkeleton v-for="i in count" :key="i" />
</template>
