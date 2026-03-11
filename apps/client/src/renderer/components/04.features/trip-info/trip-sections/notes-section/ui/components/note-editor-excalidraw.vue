<script setup lang="ts">
import type { Component } from 'vue'
import { useThemeStore } from '~/shared/store/theme.store'

interface ExcalidrawAPI {
  scrollToContent: (elements?: unknown[], opts?: { fitToContent?: boolean }) => void
  getSceneElements: () => unknown[]
}

const props = defineProps<{
  noteId: string
  content: string | null
  readonly: boolean
}>()

const emit = defineEmits<{
  'update:content': [noteId: string, value: string]
}>()

interface ExcalidrawElement {
  id: string
  type: string
  [key: string]: unknown
}

interface ExcalidrawAppState {
  collaborators: Map<string, unknown>
  [key: string]: unknown
}

interface ExcalidrawFile {
  mimeType: string
  id: string
  dataURL: string
  created: number
  lastRetrieved?: number
}

const themeStore = useThemeStore()

const excalidrawTheme = computed(() => {
  if (themeStore.activeThemeName === 'dark')
    return 'dark'
  if (themeStore.activeThemeName === 'light')
    return 'light'

  const bgColor = themeStore.customThemePalette['bg-primary-color'] || '#ffffff'
  const hex = bgColor.replace('#', '')

  if (hex.length >= 6) {
    const r = Number.parseInt(hex.substring(0, 2), 16)
    const g = Number.parseInt(hex.substring(2, 4), 16)
    const b = Number.parseInt(hex.substring(4, 6), 16)

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luma < 128 ? 'dark' : 'light'
  }

  return 'light'
})

const VueExcalidraw = shallowRef<Component | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const apiReady = ref(false)

const SAFE_APPSTATE_KEYS = [
  'theme',
  'viewBackgroundColor',
  'gridSize',
  'gridModeEnabled',
  'zenModeEnabled',
  'currentItemStrokeColor',
  'currentItemBackgroundColor',
  'currentItemFillStyle',
  'currentItemStrokeWidth',
  'currentItemFontFamily',
  'currentItemFontSize',
  'currentItemTextAlign',
] as const

interface InitialData {
  elements: ExcalidrawElement[]
  appState: Partial<ExcalidrawAppState>
  files: Record<string, ExcalidrawFile>
  scrollToContent: boolean
}

function parseInitialData(raw: string | null): InitialData | undefined {
  if (!raw)
    return undefined
  try {
    const parsed = JSON.parse(raw) as {
      elements?: ExcalidrawElement[]
      appState?: Record<string, unknown>
      files?: Record<string, ExcalidrawFile>
    }

    const safeAppState: Partial<ExcalidrawAppState> = {
      collaborators: new Map(),
    }
    for (const key of SAFE_APPSTATE_KEYS) {
      if (parsed.appState?.[key] !== undefined)
        (safeAppState as Record<string, unknown>)[key] = parsed.appState[key]
    }

    const bg = safeAppState.viewBackgroundColor as string | undefined
    if (!bg || bg === '#ffffff' || bg === '#121212' || bg === 'transparent') {
      safeAppState.viewBackgroundColor = 'transparent'
    }

    return {
      elements: parsed.elements ?? [],
      appState: safeAppState,
      files: parsed.files ?? {},
      scrollToContent: true,
    }
  }
  catch {
    return undefined
  }
}

function onExcalidrawAPI(api: ExcalidrawAPI) {
  setTimeout(() => {
    api.scrollToContent(api.getSceneElements(), { fitToContent: true })
    apiReady.value = true
  }, 150)
}

const initialData = shallowRef<InitialData | undefined>(
  props.content ? parseInitialData(props.content) : undefined,
)

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastEmittedContent: string | null = null
let lastComputedContent: string | null = null

function debouncedSave(newContent: string): void {
  if (saveTimer)
    clearTimeout(saveTimer)

  saveTimer = setTimeout(() => {
    saveTimer = null
    lastEmittedContent = newContent
    emit('update:content', props.noteId, newContent)
  }, 1000)
}

function flushSave(): void {
  if (saveTimer && lastComputedContent && lastComputedContent !== lastEmittedContent) {
    clearTimeout(saveTimer)
    saveTimer = null
    emit('update:content', props.noteId, lastComputedContent)
  }
}

function handleChange(
  elements: ExcalidrawElement[],
  appState: Partial<ExcalidrawAppState>,
  files: Record<string, ExcalidrawFile>,
): void {
  if (props.readonly || !apiReady.value)
    return

  const safeAppState: Record<string, unknown> = {}
  for (const key of SAFE_APPSTATE_KEYS) {
    if (key in appState) {
      safeAppState[key] = appState[key]
    }
  }

  const scene = { elements, appState: safeAppState, files }
  const newContent = JSON.stringify(scene)

  if (newContent === props.content || newContent === lastComputedContent)
    return

  lastComputedContent = newContent
  debouncedSave(newContent)
}

onMounted(async () => {
  try {
    const [{ applyPureReactInVue }, excalidrawModule] = await Promise.all([
      import('veaury'),
      import('@excalidraw/excalidraw'),
      import('@excalidraw/excalidraw/index.css'),
    ])

    const ExcalidrawReact
      = excalidrawModule.Excalidraw
        ?? (excalidrawModule as Record<string, unknown>).default

    if (!ExcalidrawReact)
      throw new Error('Excalidraw не найден в пакете @excalidraw/excalidraw')

    VueExcalidraw.value = applyPureReactInVue(ExcalidrawReact)
    isLoading.value = false
  }
  catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Не удалось загрузить редактор'
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  flushSave()
})
</script>

<template>
  <div class="excalidraw-wrapper">
    <div v-if="isLoading" class="ex-state">
      <span class="ex-spinner" />
      <span>Загрузка редактора...</span>
    </div>

    <div v-else-if="loadError" class="ex-state ex-state--error">
      <span class="ex-state-icon">⚠️</span>
      <p class="ex-state-title">
        Не удалось загрузить Excalidraw
      </p>
      <span class="ex-state-detail">{{ loadError }}</span>
    </div>

    <component
      :is="VueExcalidraw"
      v-else
      v-bind="{
        initialData,
        theme: excalidrawTheme,
        excalidrawAPI: onExcalidrawAPI,
        viewModeEnabled: readonly,
        langCode: 'ru',
        UIOptions: { canvasActions: { saveToActiveFile: false } },
      }"
      @change="handleChange"
    />
  </div>
</template>

<style scoped lang="scss">
.excalidraw-wrapper {
  height: 100%;
  width: 100%;
  position: relative;
  background: var(--bg-primary-color);

  :deep(.excalidraw) {
    --island-bg-color: var(--bg-secondary-color) !important;
    --color-surface-low: var(--bg-secondary-color) !important;
    --color-surface-mid: var(--bg-tertiary-color) !important;
    --color-surface-highest: var(--bg-inverted-color) !important;

    --color-on-surface: var(--fg-primary-color) !important;
    --icon-fill-color: var(--fg-primary-color) !important;
    --text-primary-color: var(--fg-primary-color) !important;

    --color-primary: var(--fg-accent-color) !important;
    --color-primary-darker: var(--fg-action-color) !important;
    --color-primary-light: var(--bg-accent-color) !important;

    --button-hover-bg: var(--bg-hover-color) !important;
    --button-gray-1: var(--bg-tertiary-color) !important;
    --button-gray-2: var(--bg-hover-color) !important;

    --default-border-color: var(--border-secondary-color) !important;
    --input-border-color: var(--border-secondary-color) !important;

    --shadow-island: var(--shadow-m, 0 4px 16px rgba(0, 0, 0, 0.12)) !important;

    --color-canvas-background: transparent !important;
  }

  :deep(.excalidraw.theme--dark) {
    --island-bg-color: var(--bg-secondary-color) !important;
    --color-surface-low: var(--bg-secondary-color) !important;
    --color-surface-mid: var(--bg-tertiary-color) !important;
    --color-on-surface: var(--fg-primary-color) !important;
    --icon-fill-color: var(--fg-primary-color) !important;
    --button-hover-bg: var(--bg-hover-color) !important;
    --default-border-color: var(--border-secondary-color) !important;
  }

  :deep([__use_react_component_wrap]) {
    display: block !important;
    height: 100% !important;
    width: 100% !important;
  }

  :deep(.excalidraw) {
    height: 100% !important;
    width: 100% !important;

    .main-menu-trigger {
      display: none !important;
    }

    .sidebar-trigger.default-sidebar-trigger {
      display: none !important;
    }

    .App-menu_top__left {
      gap: 0 !important;
      padding-left: 0 !important;
    }
  }
}
.ex-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;

  &--error {
    color: var(--fg-error-color);
  }
}

.ex-state-icon {
  font-size: 2.5rem;
}

.ex-state-title {
  margin: 0;
  font-weight: 500;
}

.ex-state-detail {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  max-width: 320px;
  text-align: center;
  word-break: break-word;
}

.ex-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-secondary-color);
  border-top-color: var(--fg-accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
