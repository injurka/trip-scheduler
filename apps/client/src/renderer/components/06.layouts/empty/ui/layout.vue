<script lang="ts" setup>
import { useRoute } from 'vue-router'
import { BackgroundEffects } from '~/components/02.shared/background-effects'
import { AppRouteNames, AppRoutePaths } from '~/shared/constants/routes'
import { isMobileApp } from '~/shared/lib/env'

const route = useRoute()
</script>

<template>
  <main
    class="main empty-layout"
    :class="{ 'main--welcome-edge-to-edge': isMobileApp && (route.name === AppRouteNames.Root || route.path === AppRoutePaths.Root) }"
  >
    <div
      v-if="isMobileApp && !(route.name === AppRouteNames.Root || route.path === AppRoutePaths.Root)"
      class="system-bar-top-scrim"
      aria-hidden="true"
    />
    <div class="main-content">
      <slot />
    </div>

    <BackgroundEffects />
  </main>
</template>

<style scoped lang="scss">
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  overflow-x: clip;
  min-height: 100dvh;
  box-sizing: border-box;
  padding-top: 0;
  padding-bottom: var(--safe-area-inset-bottom);

  @media (max-width: 768px) {
    background-color: var(--bg-primary-color);
  }
}

:global(.is-mobile-app .empty-layout),
:global(.is-tauri .empty-layout) {
  background-color: var(--bg-primary-color);
}

.main--welcome-edge-to-edge {
  padding-top: 0;
  // Welcome сам заливает фоном зону навбара и отступает от неё внутри
  padding-bottom: 0;
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
