<script setup lang="ts">
import type { ThemePreset } from '../../constants/color-presets'
import type { ColorPalette } from '~/shared/store/theme.store'

const props = defineProps<{
  presets: ThemePreset[]
  currentPalette?: ColorPalette
}>()

const emit = defineEmits<{
  (e: 'applyPreset', palette: ColorPalette): void
}>()

function isPresetActive(preset: ThemePreset): boolean {
  if (!props.currentPalette)
    return false
  return (
    preset.palette['bg-primary-color'] === props.currentPalette['bg-primary-color']
    && preset.palette['fg-accent-color'] === props.currentPalette['fg-accent-color']
    && preset.palette['bg-secondary-color'] === props.currentPalette['bg-secondary-color']
  )
}
</script>

<template>
  <div class="preset-selector">
    <div class="presets-description">
      <p>
        Пресеты — это готовые наборы цветовых переменных, которые определяют внешний вид интерфейса.
        Вы можете выбрать один из предложенных пресетов в качестве отправной точки для своей
        пользовательской темы. После выбора пресета его цвета будут применены, и вы сможете
        отредактировать их во вкладке «Цвета».
      </p>
    </div>
    <div class="presets-grid">
      <div
        v-for="preset in presets"
        :key="preset.name"
        class="preset-card"
        :class="{ 'is-active': isPresetActive(preset) }"
        @click="emit('applyPreset', preset.palette)"
      >
        <div class="preset-preview">
          <span
            v-for="(color, key) in preset.palette"
            :key="key"
            class="preset-color-chip"
            :style="{ backgroundColor: color }"
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
  margin-bottom: 24px;
  padding: 0 6px;

  p {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    line-height: 1.5;
    margin: 0;
  }
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  padding: 6px;
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

  &.is-active {
    border-color: var(--border-pressed-color);
    box-shadow:
      0 0 0 1px var(--border-pressed-color),
      0 4px 12px var(--bg-overlay-primary-color);
    background-color: var(--bg-secondary-color);

    .preset-name {
      color: var(--fg-accent-color);
      font-weight: 600;
    }
  }
}

.preset-preview {
  display: flex;
  height: 24px;
  border-radius: var(--r-2xs);
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid var(--border-secondary-color);
}

.preset-color-chip {
  flex: 1;
}

.preset-name {
  font-size: 0.85rem;
  text-align: center;
  color: var(--fg-secondary-color);
  margin: 0;
  font-weight: 500;
}
</style>
