<script setup lang="ts">
import type { CrepeFeature } from '@milkdown/crepe'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx, editorViewOptionsCtx, parserCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Milkdown, useEditor } from '@milkdown/vue'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import '@milkdown/crepe/theme/common/style.css'

interface Props {
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  features?: Partial<Record<CrepeFeature, boolean>>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'markdownUpdated', value: string): void
  (e: 'updated'): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()
const markdown = defineModel<string>({ required: true })

if (markdown.value === undefined) {
  markdown.value = ``
}

const crepeInstance = shallowRef<Crepe | null>(null)
const isInternalUpdate = ref(false)
const isEditorMounted = ref(false)

useEditor((root) => {
  const crepe = new Crepe({
    root,
    defaultValue: markdown.value,
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: props.placeholder || 'Начните вводить текст...',
      },
    },
    features: {
      ...props.features,
      [Crepe.Feature.Latex]: false,
    },
  })

  crepe.editor
    .config((ctx) => {
      ctx.update(editorViewOptionsCtx, prev => ({
        ...prev,
        editable: () => !props.disabled && !props.readonly,
      }))

      const listenerValue = ctx.get(listenerCtx)

      // Слушаем обновление контента из редактора
      listenerValue.markdownUpdated((_, md) => {
        isInternalUpdate.value = true
        markdown.value = md
        emit('markdownUpdated', md)

        setTimeout(() => {
          isInternalUpdate.value = false
        }, 0)
      })

      // Слушаем готовность редактора
      listenerValue.mounted(() => {
        isEditorMounted.value = true
      })

      listenerValue.updated(() => {
        emit('updated')
      })
      listenerValue.focus(() => {
        emit('focus')
      })
      listenerValue.blur(() => {
        emit('blur')
      })
    })
    .use(listener)

  crepeInstance.value = crepe
  return crepe
})

watch(() => [props.readonly, props.disabled], ([isReadonly, isDisabled]) => {
  const editor = crepeInstance.value?.editor
  if (!editor || !isEditorMounted.value)
    return

  editor.config((ctx) => {
    ctx.update(editorViewOptionsCtx, prev => ({
      ...prev,
      editable: () => !isDisabled && !isReadonly,
    }))
  })
})

watch(markdown, (newValue) => {
  // Если обновление пришло из самого редактора или редактор еще не готов — пропускаем
  if (isInternalUpdate.value || !isEditorMounted.value)
    return

  const editor = crepeInstance.value?.editor
  if (!editor)
    return

  try {
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const parser = ctx.get(parserCtx)

      const doc = parser(newValue || '')

      if (!doc)
        return

      const state = view.state
      const tr = state.tr.replaceWith(0, state.doc.content.size, doc)

      view.dispatch(tr)
    })
  }
  catch (e) {
    console.error('Ошибка обновления контента в редакторе:', e)
  }
})

onBeforeUnmount(() => {
  isEditorMounted.value = false
})
</script>

<template>
  <div
    :class="{
      'milkdown-disabled': disabled,
      'has-content': !!markdown }"
    class="kit-inline-md-editor-minimal"
  >
    <Milkdown />
  </div>
</template>

<style lang="scss" scoped>
.milkdown-disabled {
  opacity: 0.7;
  pointer-events: none;
}

.has-content :deep(.crepe-placeholder) {
  &::before {
    opacity: 0;
  }
}

// Глобальные стили для скрытия ненужных UI элементов Crepe
.kit-inline-md-editor-minimal :deep() {
  .milkdown-menu-wrapper,      // Всплывающее меню
  .milkdown-slash-wrapper,     // Slash-команды
  .milkdown-block-handle,      // Хэндлер для перетаскивания блоков
  .milkdown-image-tooltip,     // Тултип для изображений
  .milkdown-link-tooltip,      // Тултип для ссылок
  .crepe-dropdown,             // Выпадающие списки
  .crepe-table-control-bar,    // Управление таблицами
  hr {
    display: none !important;
  }

  // --- Скрытие тулбара при потере фокуса ---
  // Если внутри компонента нет фокуса, скрываем всплывающие тулбары Crepe
  &:not(:focus-within) {
    .crepe-tooltip,
    .milkdown-toolbar,
    [data-role='tooltip'] {
      display: none !important;
    }
  }

  // --- Стилизация самого редактора ---
  .milkdown {
    > div {
      padding: 0;
    }
    p {
      margin: 0;
      padding: 0;
    }
    em {
      color: var(--fg-highlight-color);
      font-style: italic;
    }
    strong {
      font-weight: bold;
    }
    code {
      color: var(--fg-secondary-color);
      background: var(--bg-tertiary-color);
      padding: 2px 4px;
      border-radius: var(--r-xs);
      font-family: var(--font-mono);
    }
    blockquote {
      padding-left: 8px;
      border-left: none;

      ::before {
        top: 1px;
        bottom: 1px;
      }
    }
    ul,
    ol {
      padding-top: 0.5em;

      .list-item {
        gap: 4px;

        .children {
          padding-top: 4px;
        }
        .bullet {
          padding: 0;
        }
      }
    }
  }
}
</style>
