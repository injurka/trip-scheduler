<script setup lang="ts">
import { useThemeStore } from '~/shared/store/theme.store'
import { shadowPresets } from '../../constants/shadow-presets'

const themeStore = useThemeStore()
const { customThemeShadowColor } = storeToRefs(themeStore)

function applyPreset(color: string) {
  themeStore.applyCustomShadowColor(color)
}

watch(customThemeShadowColor, (newColor) => {
  themeStore.applyCustomShadowColor(newColor)
})
</script>

<template>
  <div class="shadow-editor-section">
    <div class="presets-description">
      <p>
        Измените базовый цвет для генерации всех теней в интерфейсе.
        Это повлияет на тени у карточек, модальных окон и других элементов.
      </p>
    </div>

    <div class="presets-grid">
      <div
        v-for="preset in shadowPresets"
        :key="preset.name"
        class="preset-card"
        @click="applyPreset(preset.color)"
      >
        <div class="preset-preview" :style="{ backgroundColor: preset.color }" />
        <p class="preset-name">
          {{ preset.name }}
        </p>
      </div>
    </div>

    <div class="divider" />

    <div class="editor-item">
      <label for="shadow-color-input" class="editor-label">
        Пользовательский цвет
      </label>
      <div class="editor-input-group">
        <div class="a-wrapper">
          <input
            id="shadow-color-input"
            v-model="customThemeShadowColor"
            type="color"
            class="editor-color-swatch"
          >
        </div>
        <input
          v-model="customThemeShadowColor"
          type="text"
          class="editor-hex-input"
          placeholder="#RRGGBB"
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.shadow-editor-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.presets-description {
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
  height: 40px;
  border-radius: var(--r-2xs);
  margin-bottom: 8px;
  border: 1px solid var(--border-secondary-color);
}

.preset-name {
  font-size: 0.85rem;
  text-align: center;
  color: var(--fg-secondary-color);
  margin: 0;
  font-weight: 500;
}

.divider {
  height: 1px;
  background-color: var(--border-primary-color);
  margin: 12px 0;
}

.editor-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
}

.editor-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.editor-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker-wrapper {
  position: relative;
  input {
    border-radius: var(--r-xs);
    overflow: hidden;
  }
}

.editor-color-swatch {
  width: 40px;
  height: 40px;
  border: 2px solid var(--border-primary-color);
  border-radius: var(--r-xs);
  cursor: pointer;
  background-color: transparent;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  transition: border-color 0.2s;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  &::-webkit-color-swatch,
  &::-moz-color-swatch {
    border: none;
    border-radius: var(--r-2xs);
  }
}

.editor-hex-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-xs);
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--border-accent-color);
  }
}
</style>
