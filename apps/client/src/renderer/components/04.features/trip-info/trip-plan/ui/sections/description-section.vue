<script setup lang="ts">
import type { ActivitySectionText } from '~/shared/types/models/activity'
import { KitMarkdownViewer } from '~/components/01.kit/kit-markdown-viewer'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { getDocumentLinkPath } from '~/shared/lib/document-link'
import { lazyComponent } from '~/shared/lib/lazy-component'
import { openExternalUrl } from '~/shared/lib/opener'
import { resolveApiUrl } from '~/shared/lib/url'

interface Props {
  section: ActivitySectionText
}

const props = defineProps<Props>()
const emit = defineEmits(['updateSection'])

const store = useModuleStore(['ui'])

const KitInlineMdEditorWrapper = lazyComponent(() => import('~/components/01.kit/kit-inline-md-editor').then(module => module.KitInlineMdEditorWrapper))
const { isViewMode } = storeToRefs(store.ui)
const sectionModel = ref<string>(props.section.text)

function handleDocumentClick(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a')
  const href = link?.getAttribute('href')

  if (!href?.startsWith('#trip-document='))
    return

  event.preventDefault()
  event.stopPropagation()
  const path = getDocumentLinkPath(href)

  if (path)
    void openExternalUrl(resolveApiUrl(path))
}
function handleInlineEditorBlur() {
  emit('updateSection', { ...props.section, text: sectionModel.value })
}
</script>

<template>
  <div class="description-section" @click.capture="handleDocumentClick">
    <KitMarkdownViewer
      v-if="isViewMode"
      :markdown="sectionModel"
      placeholder="Добавьте заметку или описание..."
      class="section-editor"
    />
    <KitInlineMdEditorWrapper
      v-else
      v-model="sectionModel"
      placeholder="Добавьте заметку или описание..."
      class="section-editor"
      @blur="handleInlineEditorBlur()"
    />
  </div>
</template>

<style scoped lang="scss">
.description-section {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 4px 8px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.section-editor {
  width: 100%;

  :deep(.kit-markdown-viewer__content > p) {
    p {
      margin: 0 !important;
      line-height: 1.6;
    }
  }
}
</style>
