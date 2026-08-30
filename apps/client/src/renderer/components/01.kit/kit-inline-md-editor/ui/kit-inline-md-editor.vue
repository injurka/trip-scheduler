<script setup lang="ts">
import type { CrepeFeature } from '@milkdown/crepe'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx, editorViewOptionsCtx, parserCtx } from '@milkdown/kit/core'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { codeBlockSchema, htmlSchema } from '@milkdown/preset-commonmark'
import { $view } from '@milkdown/utils'
import { Milkdown, useEditor } from '@milkdown/vue'
import { addFullscreenButton, renderMermaidDiagram } from '../lib/mermaid-renderer'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

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
const markdown = defineModel<string | null>({ required: true })

if (markdown.value === undefined) {
  markdown.value = ``
}

const crepeInstance = shallowRef<Crepe | null>(null)
const isInternalUpdate = ref(false)
const isEditorMounted = ref(false)

const htmlView = $view(htmlSchema.node, () => (node) => {
  const dom = document.createElement('span')
  dom.className = 'milkdown-html-inline'
  dom.innerHTML = (node.attrs.value as string) || ''
  return {
    dom,
    update: (updatedNode) => {
      if (updatedNode.type.name !== 'html')
        return false
      dom.innerHTML = (updatedNode.attrs.value as string) || ''
      return true
    },
  }
})

const mermaidView = $view(codeBlockSchema.node, () => (node) => {
  const language = (node.attrs.language as string) || ''

  if (language.toLowerCase() === 'mermaid') {
    const dom = document.createElement('div')
    dom.className = 'milkdown-mermaid-container'

    const diagramDiv = document.createElement('div')
    diagramDiv.className = 'mermaid-diagram'
    dom.appendChild(diagramDiv)

    const contentDOM = document.createElement('pre')
    contentDOM.className = 'mermaid-raw-code'
    contentDOM.style.display = 'none'
    dom.appendChild(contentDOM)

    let currentRenderId = 0

    const render = async (codeText: string) => {
      const renderId = ++currentRenderId
      const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`
      try {
        const svg = await renderMermaidDiagram(codeText, uniqueId)
        if (renderId !== currentRenderId)
          return
        if (svg) {
          diagramDiv.innerHTML = svg
          diagramDiv.style.display = 'block'
          contentDOM.style.display = 'none'
        }
        else {
          diagramDiv.style.display = 'none'
          contentDOM.style.display = 'block'
        }
      }
      catch {
        diagramDiv.style.display = 'none'
        contentDOM.style.display = 'block'
      }
    }

    render(node.textContent)

    // Add fullscreen button after render
    const getSvg = () => diagramDiv.querySelector('svg')
    addFullscreenButton(dom, getSvg)

    // Listen for theme change → re-render
    const onThemeChange = () => render(node.textContent)
    dom.addEventListener('mermaid-theme-change', onThemeChange)

    return {
      dom,
      contentDOM,
      update: (updatedNode) => {
        if (updatedNode.type.name !== 'code_block')
          return false
        if (updatedNode.textContent !== node.textContent) {
          render(updatedNode.textContent)
        }
        return true
      },
      ignoreMutation: (mutation) => {
        return mutation.target !== contentDOM && !contentDOM.contains(mutation.target)
      },
      destroy: () => {
        dom.removeEventListener('mermaid-theme-change', onThemeChange)
      },
    }
  }

  // Standard code block
  const dom = document.createElement('pre')
  dom.className = 'milkdown-code-block'
  if (language)
    dom.dataset.language = language
  const contentDOM = document.createElement('code')
  dom.appendChild(contentDOM)

  return {
    dom,
    contentDOM,
    update: (updatedNode) => {
      if (updatedNode.type.name !== 'code_block')
        return false
      return true
    },
  }
})

function getEditorAttributes(prevAttributes: any) {
  let existingClasses = ''
  if (prevAttributes && typeof prevAttributes.class === 'string') {
    existingClasses = prevAttributes.class
  }

  const newClasses = existingClasses

  return {
    ...prevAttributes,
    translate: 'yes',
    class: newClasses,
  }
}

useEditor((root) => {
  const crepe = new Crepe({
    root,
    defaultValue: markdown.value || '',
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
    .use(htmlView)
    .use(mermaidView)
    .config((ctx) => {
      ctx.update(editorViewOptionsCtx, prev => ({
        ...prev,
        editable: () => !props.disabled && !props.readonly,
        attributes: (state) => {
          const prevAttrs = typeof prev.attributes === 'function'
            ? prev.attributes(state)
            : (prev.attributes || {})

          return getEditorAttributes(prevAttrs)
        },
      }))

      const listenerValue = ctx.get(listenerCtx)

      listenerValue.markdownUpdated((_, md) => {
        isInternalUpdate.value = true
        markdown.value = md
        emit('markdownUpdated', md)
        setTimeout(() => {
          isInternalUpdate.value = false
        }, 0)
      })

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

  try {
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)

      view.setProps({
        editable: () => !isDisabled && !isReadonly,
      })
    })
  }
  catch (e) {
    console.error('Failed to update editor props:', e)
  }
})

watch(markdown, (newValue) => {
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
      'has-content': !!markdown,
    }"
    translate="yes"
    class="kit-inline-md-editor-minimal"
  >
    <Milkdown />
  </div>
</template>

<style lang="scss" scoped>
.kit-inline-md-editor-minimal {
  --crepe-color-background: transparent !important;
  --crepe-color-surface: var(--bg-secondary-color) !important;
  --crepe-color-surface-low: var(--bg-tertiary-color) !important;
  --crepe-color-on-background: var(--fg-primary-color) !important;
  background-color: transparent !important;
  background: transparent !important;
}

.milkdown-disabled {
  opacity: 0.7;
  pointer-events: none;
}

.has-content :deep(.crepe-placeholder) {
  &::before {
    opacity: 0;
  }
}

.kit-inline-md-editor-minimal :deep(.table-container) {
  width: 100%;
  overflow-x: auto;
  margin: 1rem 0;

  table {
    min-width: 100%;
    border-collapse: collapse;
  }
}

.kit-inline-md-editor-minimal :deep() {
  .milkdown {
    background-color: transparent !important;
    background: transparent !important;
    color: var(--fg-primary-color) !important;
  }

  .milkdown .ProseMirror {
    padding: 0 !important;
  }

  .milkdown-menu-wrapper,
  .milkdown-slash-wrapper,
  .milkdown-block-handle,
  .milkdown-image-tooltip,
  .milkdown-link-tooltip,
  .crepe-dropdown,
  .crepe-table-control-bar {
    display: none !important;
  }

  .ProseMirror {
    background-color: transparent !important;
    background: transparent !important;
    font-family: 'Rubik', sans-serif !important;
    color: var(--fg-primary-color);
    font-size: 0.9375rem;
    line-height: 1.6;

    // Headings - Compact, balanced, elegant typography
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      font-family: 'Rubik', sans-serif !important;
      color: var(--fg-primary-color);
      letter-spacing: -0.015em;
    }

    h1 {
      font-size: 1.35rem !important;
      font-weight: 700 !important;
      line-height: 1.3 !important;
      margin-top: 1.4rem !important;
      margin-bottom: 0.5rem !important;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--border-secondary-color);
    }

    h2 {
      font-size: 1.15rem !important;
      font-weight: 600 !important;
      line-height: 1.35 !important;
      margin-top: 1.2rem !important;
      margin-bottom: 0.4rem !important;
    }

    h3 {
      font-size: 1.02rem !important;
      font-weight: 600 !important;
      line-height: 1.4 !important;
      margin-top: 1rem !important;
      margin-bottom: 0.35rem !important;
    }

    h4 {
      font-size: 0.95rem !important;
      font-weight: 600 !important;
      line-height: 1.4 !important;
      margin-top: 0.8rem !important;
      margin-bottom: 0.3rem !important;
    }

    h5,
    h6 {
      font-size: 0.88rem !important;
      font-weight: 600 !important;
      line-height: 1.4 !important;
      margin-top: 0.7rem !important;
      margin-bottom: 0.25rem !important;
      color: var(--fg-secondary-color);
    }

    p {
      margin: 0.35rem 0 !important;
      line-height: 1.6;
    }

    hr {
      display: block !important;
      border: none !important;
      border-top: 1px solid var(--border-secondary-color) !important;
      margin: 1.25rem 0 !important;
      height: 1px !important;
      opacity: 0.7;
    }

    ul,
    ol {
      margin: 0.4rem 0 !important;
      padding-left: 0.25rem !important;
      list-style: none !important;

      .list-item,
      li {
        display: flex !important;
        align-items: baseline !important;
        gap: 6px !important;
        margin: 0.25rem 0 !important;
        line-height: 1.6 !important;
        list-style: none !important;

        .label-wrapper {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          // Match one cap-height of the text: approx 0.7 * font-size * line-height ≈ 1.12em
          // Using translate we shift the icon back onto the baseline center
          flex-shrink: 0 !important;
          width: 1.25rem !important;
          height: 1em !important;
          // baseline aligns the bottom of .label-wrapper with text baseline
          // shift up by half the icon height (0.5em) to visually center on first line
          transform: translateY(0.1em) !important;
          user-select: none !important;

          .bullet,
          .milkdown-icon {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 1rem !important;
            height: 1rem !important;
            color: var(--fg-accent-color) !important;

            svg {
              width: 12px !important;
              height: 12px !important;
              fill: currentColor !important;

              circle {
                fill: currentColor !important;
              }
            }
          }

          .label {
            font-size: 0.85em;
            font-weight: 600;
            color: var(--fg-accent-color);
          }
        }

        .children {
          flex: 1 1 auto !important;
          min-width: 0 !important;

          .content-dom,
          p {
            margin: 0 !important;
            line-height: 1.6 !important;
          }
        }
      }
    }

    strong {
      font-weight: 600 !important;
      color: var(--fg-primary-color);
    }

    em {
      color: var(--fg-highlight-color);
      font-style: italic;
    }

    code {
      font-family: var(--font-mono, monospace) !important;
      font-size: 0.85em;
      color: var(--fg-accent-color);
      background: var(--bg-tertiary-color);
      padding: 2px 5px;
      border-radius: var(--r-xs, 4px);
      border: 1px solid var(--border-secondary-color);
    }

    a {
      color: var(--fg-accent-color);
      text-decoration: underline;
      text-underline-offset: 3px;
      transition: opacity 0.15s ease;

      &:hover {
        opacity: 0.8;
      }
    }

    blockquote {
      margin: 0.8rem 0 !important;
      padding: 0.6rem 1rem !important;
      border-left: 3px solid var(--fg-accent-color) !important;
      background: var(--bg-tertiary-color);
      border-radius: 0 var(--r-xs, 4px) var(--r-xs, 4px) 0;
      color: var(--fg-secondary-color);
      font-style: italic;

      p {
        margin: 0 !important;
      }
    }

    pre {
      background: var(--bg-tertiary-color) !important;
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-s, 6px);
      padding: 12px 16px;
      overflow-x: auto;
      font-family: var(--font-mono, monospace) !important;
      font-size: 0.85rem;
      line-height: 1.5;
      margin: 0.6rem 0;
    }

    .table-container {
      overflow-x: auto;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.6rem 0;
      font-size: 0.875rem;
    }

    th,
    td {
      border: 1px solid var(--border-secondary-color);
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: var(--bg-tertiary-color);
      font-weight: 600;
    }

    // Image styling
    img {
      max-width: 100%;
      height: auto;
      border-radius: var(--r-s, 6px);
      margin: 0.8rem auto;
      display: block;
    }

    // Tag styling
    [data-tag] {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      margin: 0 2px;

      &.tp-tag-default {
        background: var(--bg-accent-color);
        color: var(--fg-accent-color);
      }

      &.tp-tag-must-do {
        background: #06310e;
        color: #6fcf97;
      }

      &.tp-tag-warning {
        background: #441717;
        color: #f43f5e;
      }
    }
  }

  .milkdown-mermaid-container {
    margin: 1.25rem 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m, 8px);
    padding: 16px;
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;

    .mermaid-diagram {
      display: block;
      min-height: 80px;
      max-width: 100%;

      svg {
        max-width: none;
        height: auto;
      }
    }

    .mermaid-raw-code {
      font-family: var(--font-mono, monospace);
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      padding: 8px;
      white-space: pre-wrap;
    }
  }

  .table-wrapper {
    overflow-x: auto;
    margin: 1.25em 0;
    border-radius: var(--r-s, 6px);
    border: 1px solid var(--border-secondary-color, #e0e0e0);

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;

      th {
        background: var(--bg-tertiary-color);
        font-weight: 600;
        text-align: left;
      }

      th,
      td {
        border: 1px solid var(--border-secondary-color, #e0e0e0);
        padding: 8px 12px;
      }
    }
  }
}
</style>
