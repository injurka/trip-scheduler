<script lang="ts" setup>
import { useHead } from '@vueuse/head'
import { BackgroundEffects } from '~/components/02.shared/background-effects'
import { isMobileApp } from '~/shared/lib/env'

useHead({
  htmlAttrs: {
    class: 'layout-empty',
  },
})
</script>

<template>
  <main class="main empty-layout">
    <div v-if="isMobileApp" class="system-bar-top-scrim" aria-hidden="true" />
    <div class="main-content">
      <slot />
    </div>

    <BackgroundEffects />
  </main>
</template>

<style scoped lang="scss">
:global(html.layout-empty),
:global(html:has(.empty-layout)),
:global(body:has(.empty-layout)) {
  scrollbar-gutter: auto !important;
  overflow: hidden !important;
}

.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  overflow: clip;
  padding-top: var(--safe-area-inset-top);
  padding-bottom: var(--safe-area-inset-bottom);
  min-height: 100dvh;
  box-sizing: border-box;
}

.system-bar-top-scrim {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: calc(var(--safe-area-inset-top) + 16px);
  background: linear-gradient(to bottom, rgba(var(--bg-primary-color-rgb), 0.95) 0%, transparent 100%);
  pointer-events: none;
  z-index: 10;
}

.main-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
}
</style>
