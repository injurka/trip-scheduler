<script setup lang="ts">
import { PostEditor } from '~/components/05.modules/post'

const isMapPinned = ref(false)
</script>

<template>
  <section class="content-wrapper" :class="{ 'is-wide': isMapPinned }">
    <PostEditor @map-pinned-change="isMapPinned = $event" />
  </section>
</template>

<style scoped lang="scss">
.content-wrapper.is-wide {
  max-width: 2400px;
}
</style>
