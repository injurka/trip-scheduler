<script setup lang="ts">
import type { RadiusPreset } from '../../constants/radius-presets'
import type { RadiusPalette } from '~/shared/store/theme.store'

defineProps<{
  presets: RadiusPreset[]
}>()

const emit = defineEmits<{
  (e: 'applyPreset', palette: RadiusPalette): void
}>()
</script>

<template>
  <div class="preset-selector">
    <div class="presets-description">
      <p>
        Выберите один из готовых наборов скруглений или настройте их вручную ниже.
      </p>
    </div>
    <div class="presets-grid">
      <div
        v-for="preset in presets"
        :key="preset.name"
        class="preset-card"
        @click="emit('applyPreset', preset.radius)"
      >
        <div class="preset-preview">
          <div
            class="preview-shape"
            :style="{
              borderTopLeftRadius: preset.radius['r-2xs'],
              borderTopRightRadius: preset.radius['r-s'],
              borderBottomLeftRadius: preset.radius['r-l'],
              borderBottomRightRadius: preset.radius['r-xl'],
            }"
          />
        </div>
        <p class="preset-name">
          {{ preset.name }}
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.presets-description {
  margin-bottom: 16px;

  p {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    line-height: 1.5;
    margin: 0;
  }
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.preset-card {
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--border-accent-color);
    box-shadow: 0 4px 12px var(--bg-overlay-primary-color);
  }
}

.preset-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
  margin-bottom: 8px;
}

.preview-shape {
  width: 40px;
  height: 40px;
  background: var(--bg-secondary-color);
  border: 2px solid var(--bg-highlight-color);
  transition: all 0.2s ease;
}

.preset-name {
  font-size: 0.85rem;
  text-align: center;
  color: var(--fg-secondary-color);
  margin: 0;
  font-weight: 500;
}
</style>
