<script setup lang="ts">
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import type { ColorPalette, RadiusPalette } from '~/shared/store/theme.store'
import { ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { useDisplay } from '~/shared/composables/use-display'
import { useThemeStore } from '~/shared/store/theme.store'
import { themePresets } from '../../constants/color-presets'
import { radiusPresets } from '../../constants/radius-presets'
import ColorEditorGrid from './color-editor-grid.vue'
import ColorPresetSelector from './preset-selector.vue'
import RadiusEditorGrid from './radius-editor-grid.vue'
import RadiusPresetSelector from './radius-preset-selector.vue'
import ShadowEditorSection from './shadow-editor-section.vue'

const emit = defineEmits<{
  (e: 'upload'): void
  (e: 'reset'): void
  (e: 'resetRadius'): void
  (e: 'resetShadows'): void
}>()

const themeStore = useThemeStore()
const { customThemePalette, customThemeRadius } = storeToRefs(themeStore)

type EditorTab = 'presets' | 'colors' | 'radius' | 'shadows'

const activeTab = ref<EditorTab>('presets')

const viewItems: ViewSwitcherItem<EditorTab>[] = [
  { id: 'presets', label: 'Пресеты', icon: 'mdi:palette-swatch-outline' },
  { id: 'colors', label: 'Цвета', icon: 'mdi:eyedropper-variant' },
  { id: 'radius', label: 'Радиусы', icon: 'mdi:vector-radius' },
  { id: 'shadows', label: 'Тени', icon: 'mdi:box-shadow' },
]

function applyPreset(palette: ColorPalette) {
  Object.assign(customThemePalette.value, palette)
  activeTab.value = 'colors'
}

function applyRadiusPreset(radius: RadiusPalette) {
  themeStore.applyCustomRadius(radius)
}

const { mdAndDown } = useDisplay()
</script>

<template>
  <div class="theme-editor">
    <KitTabs v-model="activeTab" :items="viewItems">
      <!-- Слот для вкладки 'presets' -->
      <template #presets>
        <ColorPresetSelector
          :presets="themePresets"
          @apply-preset="applyPreset"
        />
      </template>

      <!-- Слот для вкладки 'colors' -->
      <template #colors>
        <div class="tab-pane">
          <div class="tab-pane-actions">
            <KitBtn icon="mdi:upload" variant="outlined" color="secondary" @click="emit('upload')">
              {{ mdAndDown ? '' : 'Загрузить' }}
            </KitBtn>
            <KitBtn icon="mdi:restore" variant="outlined" color="secondary" @click="emit('reset')">
              {{ mdAndDown ? '' : 'Сбросить цвета' }}
            </KitBtn>
          </div>
          <ColorEditorGrid v-model="customThemePalette" />
        </div>
      </template>

      <!-- Слот для вкладки 'radius' -->
      <template #radius>
        <div class="tab-pane">
          <RadiusPresetSelector :presets="radiusPresets" @apply-preset="applyRadiusPreset" />
          <div class="divider" />
          <div class="tab-pane-actions tab-pane-actions--between">
            <h3 class="pane-subtitle">
              Ручная настройка
            </h3>
            <KitBtn icon="mdi:restore" variant="outlined" color="secondary" @click="emit('resetRadius')">
              {{ mdAndDown ? '' : 'Сбросить радиус' }}
            </KitBtn>
          </div>
          <RadiusEditorGrid v-model="customThemeRadius" />
        </div>
      </template>

      <!-- Слот для вкладки 'shadows' -->
      <template #shadows>
        <div class="tab-pane">
          <div class="tab-pane-actions">
            <KitBtn icon="mdi:restore" variant="outlined" color="secondary" @click="emit('resetShadows')">
              {{ mdAndDown ? '' : 'Сбросить тени' }}
            </KitBtn>
          </div>
          <ShadowEditorSection />
        </div>
      </template>
    </KitTabs>
  </div>
</template>

<style lang="scss" scoped>
.theme-editor {
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  width: 700px;
  max-width: 100%;
}

.divider {
  height: 1px;
  background-color: var(--border-primary-color);
  margin: 12px 0 0 0;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
  min-height: 200px;
}

.tab-pane-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;

  &--between {
    justify-content: space-between;
  }
}

.pane-subtitle {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

@include media-down(sm) {
  .theme-editor {
    width: 100%;
  }
}
</style>
