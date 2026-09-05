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
  overflow: clip;

  &:has(.is-map-mode) {
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;

    :deep(.app-footer) {
      display: none;
    }
  }
}

.main-content {
  height: 100%;
  display: flex;
  flex-grow: 1;

  // Хедер absolute (вне потока) — отступ от него лежит на корне страницы
  // (.content-wrapper): фон страницы тянется до верха под хедером, контент
  // начинается ниже. !important перебивает scoped padding страниц
  // (специфичность ничья 0,2,0, порядок в бандле ненадёжен)
  > :deep(.content-wrapper) {
    padding-top: var(--header-actual-height, var(--header-height)) !important;

    // Полноэкранный режим карты — в вебе отступ не нужен, но в Tauri он обязателен
    &.is-map-mode {
      padding-top: 0 !important;

      :global(html.is-tauri) & {
        padding-top: var(--header-actual-height, var(--header-height)) !important;
      }
    }
  }
}
</style>
