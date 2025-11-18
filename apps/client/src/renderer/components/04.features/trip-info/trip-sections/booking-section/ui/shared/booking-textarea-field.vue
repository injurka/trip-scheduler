<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'

interface Props {
  label: string
  icon?: string
  readonly: boolean
}

defineProps<Props>()
const modelValue = defineModel<string>()

const internalModel = computed({
  get: () => modelValue.value ?? '',
  set: (value) => {
    modelValue.value = value
  },
})
</script>

<template>
  <div class="booking-textarea-field">
    <label class="field-label">
      <Icon v-if="icon" :icon="icon" class="field-icon" />
      {{ label }}
    </label>
    <div class="editor-wrapper" :class="{ 'is-readonly': readonly }">
      <KitInlineMdEditorWrapper
        v-model="internalModel"
        :readonly="readonly"
        placeholder="Добавьте заметки..."
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.booking-textarea-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
  margin-left: 2px;
}
.field-icon {
  font-size: 1rem;
  color: var(--fg-tertiary-color);
}
.editor-wrapper {
  padding: 0.5rem 0.6rem;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  transition: all 0.2s ease;
  min-height: 36px;
  line-height: 36px;

  &:focus-within {
    border-color: var(--border-focus-color);
    background-color: var(--bg-primary-color);
  }

  :deep() {
    .milkdown .ProseMirror p {
      font-size: 0.9rem;
      color: var(--fg-primary-color);
    }
  }
}
.is-readonly {
  background-color: transparent;
  border-color: transparent;
  padding: 0;
  font-size: 0.9rem;
  color: var(--fg-primary-color);
}
</style>
