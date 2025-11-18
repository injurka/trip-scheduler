<script setup lang="ts">
import type { ThemeType } from '~/shared/types/models/theme'
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import ThemeChooser from './sections/theme-chooser.vue'
import ThemeEditor from './sections/theme-editor.vue'

const store = useAppStore(['theme'])
const { isCreatorOpen, activeThemeName } = storeToRefs(store.theme)

const showCustomizer = ref(false)
const jsonInput = ref<HTMLInputElement | null>(null)

function selectTheme(themeName: ThemeType) {
  store.theme.setTheme(themeName)

  if (themeName !== 'custom') {
    showCustomizer.value = false
  }
}

function openCustomizer() {
  store.theme.setTheme('custom')
  showCustomizer.value = true
}

function triggerJsonUpload() {
  jsonInput.value?.click()
}

function handleJsonUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target?.result as string)
      store.theme.applyCustomPalette(json)
    }
    catch (error) {
      console.error('Ошибка при разборе JSON:', error)
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <KitDialogWithClose
    v-model:visible="isCreatorOpen"
    @after-leave="showCustomizer = false"
  >
    <template #header>
      <div class="header-content">
        <Icon :icon="showCustomizer ? 'mdi:cogs' : 'mdi:palette'" class="title-icon" />

        <span v-if="!showCustomizer" class="dialog-title">
          Выбор темы оформления
        </span>

        <div v-else class="breadcrumb-nav">
          <button class="breadcrumb-link" @click="showCustomizer = false">
            Выбор темы
          </button>
          <span class="breadcrumb-separator">/</span>
          <span class="dialog-title">Редактор</span>
        </div>
      </div>
    </template>

    <ThemeChooser
      v-if="!showCustomizer"
      :active-theme-name="activeThemeName"
      @select-theme="selectTheme"
      @open-customizer="openCustomizer"
    />

    <ThemeEditor
      v-else
      @reset="store.theme.resetCustomTheme"
      @reset-radius="store.theme.resetCustomRadius"
      @upload="triggerJsonUpload"
    />

    <input
      ref="jsonInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleJsonUpload"
    >
  </KitDialogWithClose>
</template>

<style lang="scss" scoped>
.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  color: var(--fg-primary-color);
}

.title-icon {
  font-size: 1.25rem;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
}

.breadcrumb-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breadcrumb-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--bg-action-hover-color);
    text-decoration: underline;
  }
}

.breadcrumb-separator {
  color: var(--fg-tertiary-color);
  font-weight: 500;
  font-size: 1.125rem;
}
</style>
