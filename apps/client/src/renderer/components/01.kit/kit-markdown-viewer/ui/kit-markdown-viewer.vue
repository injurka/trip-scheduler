<script setup lang="ts">
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  markdown?: string | null
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  markdown: '',
  placeholder: '',
})

const markdownParser = new Marked({ gfm: true })
const contentRef = ref<HTMLElement | null>(null)
let renderGeneration = 0
let mermaidId = 0
const calloutTypes: Record<string, { label: string, className: string }> = {
  tip: { label: 'Совет', className: 'milkdown-callout-tip' },
  hint: { label: 'Подсказка', className: 'milkdown-callout-tip' },
  success: { label: 'Успешно', className: 'milkdown-callout-tip' },
  note: { label: 'Заметка', className: 'milkdown-callout-note' },
  info: { label: 'Информация', className: 'milkdown-callout-note' },
  important: { label: 'Важно', className: 'milkdown-callout-important' },
  warning: { label: 'Внимание', className: 'milkdown-callout-warning' },
  warn: { label: 'Предупреждение', className: 'milkdown-callout-warning' },
  caution: { label: 'Осторожно', className: 'milkdown-callout-caution' },
  danger: { label: 'Опасно', className: 'milkdown-callout-caution' },
  question: { label: 'Вопрос', className: 'milkdown-callout-question' },
  todo: { label: 'Задачи', className: 'milkdown-callout-todo' },
  example: { label: 'Пример', className: 'milkdown-callout-example' },
}

const renderedHtml = computed(() => {
  const value = props.markdown?.trim()

  if (!value)
    return ''

  const html = markdownParser.parse(value) as string
  const sanitizedHtml = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: true,
  })

  return decorateCallouts(sanitizedHtml)
})

watch(renderedHtml, async () => {
  renderGeneration++
  await nextTick()
  void renderMermaidBlocks()
})

function decorateCallouts(html: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')

  parsed.body.querySelectorAll('blockquote').forEach(blockquote => decorateCalloutBlockquote(blockquote, parsed))

  return parsed.body.innerHTML
}

function decorateCalloutBlockquote(blockquote: HTMLElement, parsed: Document): void {
  const paragraph = blockquote.querySelector(':scope > p')
  const firstText = paragraph?.firstChild

  if (!paragraph || firstText?.nodeType !== Node.TEXT_NODE)
    return

  const text = firstText.textContent || ''
  const match = text.match(/^(\s*)\[!([a-z]+)[+-]?\][ \t]*/i)

  if (!match)
    return

  const callout = getCalloutType(match[2])
  firstText.textContent = `${match[1]}${text.slice(match[0].length)}`
  blockquote.classList.add('milkdown-callout', callout.className)

  const header = parsed.createElement('div')
  header.className = 'milkdown-callout-header'

  const title = parsed.createElement('span')
  title.className = 'milkdown-callout-title'
  title.textContent = callout.label
  header.appendChild(title)
  blockquote.prepend(header)

  if (!paragraph.textContent?.trim() && paragraph.children.length === 0)
    paragraph.remove()
}

function getCalloutType(type: string) {
  return calloutTypes[type.toLowerCase()] || {
    label: type.toUpperCase(),
    className: 'milkdown-callout-note',
  }
}
async function renderMermaidBlocks() {
  const currentGeneration = renderGeneration
  const container = contentRef.value

  if (!container)
    return

  const codeBlocks = Array.from(container.querySelectorAll('pre > code.language-mermaid'))

  if (codeBlocks.length === 0)
    return

  const { addFullscreenButton, renderMermaidDiagram } = await import('~/components/01.kit/kit-inline-md-editor/lib/mermaid-renderer')

  if (currentGeneration !== renderGeneration)
    return

  for (const code of codeBlocks) {
    const pre = code.parentElement

    if (!pre)
      continue

    const wrapper = document.createElement('div')
    wrapper.className = 'milkdown-mermaid-container'
    const diagram = document.createElement('div')
    diagram.className = 'mermaid-diagram'
    const source = document.createElement('pre')
    source.className = 'mermaid-raw-code'
    source.style.display = 'none'
    source.textContent = code.textContent || ''
    wrapper.appendChild(diagram)
    wrapper.appendChild(source)

    const render = async (): Promise<boolean> => {
      const svg = await renderMermaidDiagram(source.textContent || '', `markdown-viewer-${++mermaidId}`)

      if (currentGeneration !== renderGeneration || !wrapper.isConnected || !svg)
        return false

      diagram.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })
      const svgElement = diagram.querySelector('svg')

      if (svgElement) {
        svgElement.style.maxWidth = '100%'
        svgElement.style.width = '100%'
        svgElement.style.height = 'auto'
      }

      return true
    }

    pre.replaceWith(wrapper)
    wrapper.addEventListener('mermaid-theme-change', () => void render())
    const rendered = await render()

    if (!rendered) {
      wrapper.replaceWith(pre)
      continue
    }

    addFullscreenButton(wrapper, () => diagram.querySelector('svg'))
  }
}

onMounted(() => {
  void renderMermaidBlocks()
})
onBeforeUnmount(() => {
  renderGeneration++
})
</script>

<template>
  <div class="kit-markdown-viewer">
    <div
      v-if="renderedHtml"
      ref="contentRef"
      class="kit-markdown-viewer__content"
      v-html="renderedHtml"
    />
    <p v-else-if="placeholder" class="kit-markdown-viewer__placeholder">
      {{ placeholder }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.kit-markdown-viewer {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  color: var(--fg-primary-color);
  font-family: var(--font-base);
  font-size: 0.9375rem;
  line-height: 1.6;
  overflow-wrap: break-word;
  word-break: break-word;

  &__content {
    :deep(> :first-child) {
      margin-top: 0;
    }

    :deep(> :last-child) {
      margin-bottom: 0;
    }

    :deep(p) {
      margin: 0.6rem 0;
    }

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4),
    :deep(h5),
    :deep(h6) {
      margin: 0.9rem 0 0.45rem;
      color: var(--fg-primary-color);
      font-family: var(--font-accent);
      line-height: 1.3;
    }

    :deep(ul),
    :deep(ol) {
      padding-inline-start: 1.5rem;
      margin: 0.55rem 0;
    }

    :deep(li + li) {
      margin-top: 0.25rem;
    }

    :deep(a) {
      color: var(--fg-accent-color);
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    :deep(blockquote) {
      margin: 0.9rem 0;
      padding: 0.75rem 1.1rem;
      border-left: 3px solid var(--fg-accent-color);
      border-radius: 0 var(--r-s, 8px) var(--r-s, 8px) 0;
      background: var(--bg-secondary-color);
    }

    :deep(.milkdown-callout) {
      margin: 1.1rem 0;
      padding: 0.85rem 1.15rem 0.95rem;
      border: 1px solid var(--border-secondary-color);
      border-left: 4px solid var(--callout-accent, var(--fg-accent-color));
      border-radius: var(--r-s, 8px);
      background: var(--callout-bg, var(--bg-secondary-color));
    }

    :deep(.milkdown-callout-header) {
      margin-bottom: 0.55rem;
    }

    :deep(.milkdown-callout-title) {
      color: var(--callout-accent, var(--fg-accent-color));
      font-family: var(--font-accent);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    :deep(.milkdown-callout-tip) {
      --callout-accent: var(--fg-success-color, #67d174);
      --callout-bg: rgba(44, 73, 47, 0.2);
    }

    :deep(.milkdown-callout-note) {
      --callout-accent: var(--fg-info-color, #79b3f7);
      --callout-bg: rgba(42, 74, 110, 0.2);
    }

    :deep(.milkdown-callout-important),
    :deep(.milkdown-callout-example) {
      --callout-accent: #c084fc;
      --callout-bg: rgba(88, 28, 135, 0.2);
    }

    :deep(.milkdown-callout-warning) {
      --callout-accent: var(--fg-warning-color, #f5b971);
      --callout-bg: rgba(90, 72, 44, 0.24);
    }

    :deep(.milkdown-callout-caution) {
      --callout-accent: var(--fg-error-color, #ff879d);
      --callout-bg: rgba(109, 59, 70, 0.24);
    }

    :deep(.milkdown-callout-question) {
      --callout-accent: #2dd4bf;
      --callout-bg: rgba(19, 78, 74, 0.2);
    }

    :deep(.milkdown-callout-todo) {
      --callout-accent: #818cf8;
      --callout-bg: rgba(49, 46, 129, 0.2);
    }

    :deep(.milkdown-mermaid-container) {
      position: relative;
      display: flex;
      justify-content: safe center;
      align-items: center;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      margin: 1.25rem 0;
      padding: 16px;
      overflow-x: auto;
      overflow-y: hidden;
      box-sizing: border-box;
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-m, 8px);
      background: var(--bg-secondary-color);
    }

    :deep(.mermaid-diagram) {
      display: flex;
      justify-content: safe center;
      align-items: center;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      margin: 0 auto;
    }

    :deep(.mermaid-diagram svg) {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
    }

    :deep(pre) {
      overflow-x: auto;
      margin: 0.6rem 0;
      padding: 12px 16px;
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-s, 6px);
      background: var(--bg-tertiary-color);
      font-family: var(--font-mono, monospace);
      font-size: 0.85rem;
      line-height: 1.5;
    }

    :deep(:not(pre) > code) {
      padding: 2px 5px;
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-xs, 4px);
      background: var(--bg-tertiary-color);
      color: var(--fg-accent-color);
      font-family: var(--font-mono, monospace);
      font-size: 0.85em;
    }

    :deep(.table-container),
    :deep(table) {
      max-width: 100%;
      border-collapse: collapse;
    }

    :deep(.table-container) {
      overflow-x: auto;
      margin: 0.75rem 0;
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-s, 6px);
      -webkit-overflow-scrolling: touch;
    }

    :deep(th),
    :deep(td) {
      padding: 0.45rem 0.65rem;
      border: 1px solid var(--border-secondary-color);
      text-align: start;
    }

    :deep(img) {
      max-width: 100%;
      height: auto;
    }

    :deep(hr) {
      border: 0;
      border-top: 1px solid var(--border-secondary-color);
      margin: 1rem 0;
    }
  }

  &__placeholder {
    margin: 0;
    color: var(--fg-tertiary-color);
  }
}
</style>
