<script setup lang="ts">
import type { CrepeFeature } from '@milkdown/crepe'
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import { MilkdownProvider } from '@milkdown/vue'
import { KitInlineMdEditor } from '~/components/01.kit/kit-inline-md-editor'

interface Props {
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  features?: Partial<Record<CrepeFeature, boolean>>
  codeBlockNodeView?: (node: ProseMirrorNode) => NodeView | undefined
  codeBlockRefreshKey?: number
}

// eslint-disable-next-line unused-imports/no-unused-vars
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'markdownUpdated', value: string): void
  (e: 'updated'): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const model = defineModel<string>({ required: true, default: '' })
</script>

<template>
  <div class="kit-inline-md-editor-wrapper">
    <MilkdownProvider>
      <KitInlineMdEditor
        v-model="model"
        :="props"
        @markdown-updated="value => emit('markdownUpdated', value)"
        @updated="() => emit('updated')"
        @focus="() => emit('focus')"
        @blur="() => emit('blur')"
      />
    </MilkdownProvider>
  </div>
</template>

<style scoped lang="scss">
.kit-inline-md-editor-wrapper {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
</style>
