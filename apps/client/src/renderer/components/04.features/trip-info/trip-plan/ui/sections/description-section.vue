<script setup lang="ts">
import type { ActivitySectionText } from '~/shared/types/models/activity'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

interface Props {
  section: ActivitySectionText
}

const props = defineProps<Props>()
const emit = defineEmits(['updateSection'])
const store = useModuleStore(['ui'])

const { isViewMode } = storeToRefs(store.ui)

const sectionModel = ref<string>(props.section.text)

function handleInlineEditorBlur() {
  emit('updateSection', { ...props.section, text: sectionModel.value })
}
</script>

<template>
  <div class="description-section">
    <KitInlineMdEditorWrapper
      v-model="sectionModel"
      :readonly="isViewMode"
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

  :deep(.ProseMirror) {
    p {
      margin: 0 !important;
      line-height: 1.6;
    }
  }
}
</style>
