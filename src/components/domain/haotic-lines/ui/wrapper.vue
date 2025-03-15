<script lang="ts" setup>
import HaoticLines from './index.vue'

interface Props {
  width?: number
  height?: number
  scaleFactor?: number
  pointsCounts?: number
  speed?: number
  weightStroke?: number
  color?: string
  cap?: boolean
  viewportEl?: HTMLElement | null
}

// eslint-disable-next-line unused-imports/no-unused-vars
const props = withDefaults(defineProps<Props>(), {
  width: 0,
  height: 0,
  scaleFactor: 1.1,
  pointsCounts: 8,
  speed: 1.5,
  weightStroke: 10,
  color: '--bg-accent-overlay-color',
  cap: true,
  viewportEl: null,
})

const isShowed = ref<boolean>(false)
</script>

<template>
  <HaoticLines
    v-if="isShowed"
    :="props"
  />
</template>

<style lang="scss" scoped>

</style>
