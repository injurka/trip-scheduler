<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import ThemeEditor from './sections/theme-editor.vue'

const store = useAppStore(['theme'])
const { isCreatorOpen } = storeToRefs(store.theme)

const jsonInput = ref<HTMLInputElement | null>(null)

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
  >
    <template #header>
      <div class="header-content">
        <Icon icon="mdi:cogs" class="title-icon" />
        <span class="dialog-title">
          Настройка своей темы
        </span>
      </div>
    </template>

    <ThemeEditor
      @reset="store.theme.resetCustomTheme"
      @reset-radius="store.theme.resetCustomRadius"
      @reset-shadows="store.theme.resetCustomShadows"
      @reset-background="store.theme.resetBackgroundSettings"
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
  color: var(--fg-accent-color);
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
}
</style>
