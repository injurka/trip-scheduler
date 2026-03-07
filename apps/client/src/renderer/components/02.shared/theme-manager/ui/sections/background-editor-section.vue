<script setup lang="ts">
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitInput } from '~/components/01.kit/kit-input'
import { useThemeStore } from '~/shared/store/theme.store'

const themeStore = useThemeStore()
const { backgroundSettings } = storeToRefs(themeStore)
</script>

<template>
  <div class="background-editor-section">
    <div class="setting-group">
      <div class="group-header">
        <label class="group-label">Символы на фоне</label>
        <KitCheckbox v-model="backgroundSettings.showSymbols">
          Включить эффект
        </KitCheckbox>
      </div>
      <p class="group-description">
        Отображать плавающие иконки путешествий на заднем фоне.
      </p>
    </div>

    <div class="setting-group">
      <div class="group-header">
        <label class="group-label">Фоновое изображение</label>
        <KitCheckbox v-model="backgroundSettings.showImage">
          Показывать изображение
        </KitCheckbox>
      </div>

      <div v-if="backgroundSettings.showImage" class="image-settings">
        <KitInput
          v-model="backgroundSettings.customImageUrl"
          label="URL изображения (опционально)"
          placeholder="https://example.com/image.jpg"
          size="sm"
        />

        <div class="range-control">
          <label>Прозрачность фона: {{ Math.round(backgroundSettings.imageOpacity * 100) }}%</label>
          <input
            v-model.number="backgroundSettings.imageOpacity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="range-input"
          >
        </div>
      </div>
    </div>

    <div class="setting-group">
      <div class="group-header">
        <label class="group-label">Затемнение контента</label>
        <KitCheckbox v-model="backgroundSettings.enableContentDimming">
          Включить подложку
        </KitCheckbox>
      </div>
      <p class="group-description">
        Добавляет фон основному контенту для читаемости поверх изображения.
      </p>

      <div v-if="backgroundSettings.enableContentDimming" class="controls-wrapper">
        <div class="range-control">
          <label>Плотность подложки: {{ Math.round(backgroundSettings.contentDimmingOpacity * 100) }}%</label>
          <input
            v-model.number="backgroundSettings.contentDimmingOpacity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="range-input"
          >
        </div>

        <div class="range-control">
          <label>Ширина бокового градиента: {{ backgroundSettings.contentGradientWidth }}px</label>
          <input
            v-model.number="backgroundSettings.contentGradientWidth"
            type="range"
            min="0"
            max="500"
            step="10"
            class="range-input"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.background-editor-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-label {
  font-weight: 600;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
}

.group-description {
  margin: 0;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
}

.image-settings {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);
}

.controls-wrapper {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.range-control {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }
}

.range-input {
  width: 100%;
  accent-color: var(--fg-accent-color);
}
</style>
