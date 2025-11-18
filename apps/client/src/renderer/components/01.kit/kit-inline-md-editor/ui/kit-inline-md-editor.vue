<script setup lang="ts">
import type { CrepeFeature } from '@milkdown/crepe'
import { Crepe } from '@milkdown/crepe'
import { editorViewOptionsCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Milkdown, useEditor } from '@milkdown/vue'
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
      listenerValue.markdownUpdated((_, md) => {
        markdown.value = md
        emit('markdownUpdated', md)
      })
    })
    .use(listener)

  crepe.on((crepeListener) => {
    crepeListener.updated(() => {
      emit('updated')
    })
    crepeListener.focus(() => {
      emit('focus')
    })
    crepeListener.blur(() => {
      emit('blur')
    })
  })

  return crepe
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
  opacity: 0;
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
