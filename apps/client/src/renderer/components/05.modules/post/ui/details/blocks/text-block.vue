<script setup lang="ts">
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'

defineProps<{ content: string }>()
</script>

<template>
  <div class="text-block">
    <KitInlineMdEditorWrapper :model-value="content" :readonly="true" />
  </div>
</template>

<style scoped>
.text-block {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--fg-primary-color);
  padding: 4px 0;
}
</style>
