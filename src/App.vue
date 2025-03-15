<script setup>
import BaseLayout from '~/layouts/base.vue'

const route = useRoute()
const layout = computed(() => route.meta.layout || 'base')

const layouts = {
  base: BaseLayout,
}
</script>

<template>
  <component :is="layouts[layout]">
    <router-view />
  </component>
</template>
