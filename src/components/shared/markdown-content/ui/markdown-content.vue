<script setup lang="ts">
import { createMarkdownRenderer } from '../lib'

interface Props {
  content: string
  imageBasePath?: string
}

const props = defineProps<Props>()
const renderedContent = ref<string>('')
const md = createMarkdownRenderer({ imageBasePath: props.imageBasePath })

watch(
  () => props.content,
  (newContent) => {
    renderedContent.value = md.render(newContent || '')
  },
  { immediate: true },
)
</script>

<template>
  <div class="markdown-body" v-html="renderedContent" />
</template>

<style lang="scss">
.markdown-body {
  padding: 0;
  background-color: transparent;
  color: var(--fg-primary-color);

  em {
    color: var(--fg-accent-color);
  }

  ul {
    list-style-type: disc;

    ::marker {
      color: var(--bg-overlay-secondary-color);
    }
  }

  pre {
    background: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
    font-style: italic;
    padding-left: 16px;
    margin-top: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
    border-radius: 4px;

    code {
      white-space: wrap;
      word-wrap: break-word;
      line-height: normal;
      display: flex;
      padding: 8px 0;
    }
  }

  blockquote {
    border-left: 2px solid var(--border-accent-color);

    ol {
      margin-left: 32px;
      color: var(--fg-secondary-color);
      font-size: 0.9rem;
    }
  }

  details {
    p {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(370px, 2fr));
      gap: 10px;

      br {
        display: none;
      }

      img {
        object-fit: cover;
        max-width: 600px;
        min-height: 200px;
        height: 100%;
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
      }

      @include mobile() {
        display: flex;
        flex-wrap: wrap;
      }
    }
  }
}
</style>
