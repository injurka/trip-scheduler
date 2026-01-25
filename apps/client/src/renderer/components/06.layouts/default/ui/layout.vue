<script lang="ts" setup>
import { AppFooter } from '~/components/02.shared/app-footer'
import { AppHeader } from '~/components/02.shared/app-header'
import { BackgroundEffects } from '~/components/02.shared/background-effects'
import { ThemeManager } from '~/components/02.shared/theme-manager'
</script>

<template>
  <!-- eslint-disable vue/no-multiple-template-root -->
  <AppHeader />

  <main class="main">
    <div class="main-content">
      <slot />
    </div>

    <BackgroundEffects />

    <AppFooter />
  </main>

  <ThemeManager />
</template>

<style scoped lang="scss">
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  margin-top: -56px;
  padding-top: 56px;
}

.main-content {
  height: 100%;
  display: flex;
  flex-grow: 1;
}
</style>
