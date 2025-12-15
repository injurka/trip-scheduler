<script setup lang="ts">
import type { ActivitySectionText } from '~/shared/types/models/activity'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'

interface Props {
  section: ActivitySectionText
}

defineProps<Props>()
</script>

<template>
  <div class="description-section">
    <KitInlineMdEditorWrapper
      :model-value="section.text"
      :readonly="true"
      placeholder="Нет описания"
      class="section-editor"
    />
  </div>
</template>

<style scoped lang="scss">
.description-section {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-2xs);
}
.section-editor :deep(.milkdown) > div {
  padding: 8px;
  min-height: 30px;
}
</style>
