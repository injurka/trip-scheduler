<script setup lang="ts">
import type { CrepeFeature } from '@milkdown/crepe'
import { MilkdownProvider } from '@milkdown/vue'
import { KitInlineMdEditor } from '~/components/01.kit/kit-inline-md-editor'

interface Props {
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  features?: Partial<Record<CrepeFeature, boolean>>
}

// eslint-disable-next-line unused-imports/no-unused-vars
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'markdownUpdated', value: string): void
  (e: 'updated'): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div>
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
