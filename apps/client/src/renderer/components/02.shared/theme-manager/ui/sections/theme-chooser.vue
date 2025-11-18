<script setup lang="ts">
import type { ThemeType } from '~/shared/types/models/theme'
import ThemeCard from './theme-card.vue'

defineProps<{
  activeThemeName: ThemeType
}>()

const emit = defineEmits<{
  (e: 'selectTheme', themeName: ThemeType): void
  (e: 'openCustomizer'): void
}>()
</script>

<template>
  <div class="theme-chooser">
    <div class="theme-cards">
      <ThemeCard
        type="light"
        title="Светлая тема"
        description="Классическое светлое оформление"
        icon="mdi:white-balance-sunny"
        :is-active="activeThemeName === 'light'"
        @select="emit('selectTheme', 'light')"
      />
      <ThemeCard
        type="dark"
        title="Тёмная тема"
        description="Тёмное оформление для комфорта глаз"
        icon="mdi:moon-waning-crescent"
        :is-active="activeThemeName === 'dark'"
        @select="emit('selectTheme', 'dark')"
      />
      <ThemeCard
        type="custom"
        title="Своя тема"
        description="Создайте уникальное оформление"
        icon="mdi:palette"
        :is-active="activeThemeName === 'custom'"
        @select="emit('selectTheme', 'custom')"
        @open-settings="emit('openCustomizer')"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.theme-chooser {
  min-width: 600px;
  padding: 4px;
}

.theme-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@include media-down(sm) {
  .theme-chooser {
    min-width: auto;
  }
}
</style>
