<script setup lang="ts">
import { Icon } from '@iconify/vue'
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
  gap: 4px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.725rem;
  color: var(--fg-tertiary-color);
  font-weight: 600;
  margin-left: 2px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.field-icon {
  font-size: 1rem;
  color: var(--fg-accent-color);
}

.editor-wrapper {
  padding: 0.5rem 0.75rem;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  transition: all 0.2s ease;
  min-height: 38px;
  box-sizing: border-box;
  width: 100%;

  &:focus-within {
    border-color: var(--border-focus-color);
    background-color: var(--bg-primary-color);
  }

  :deep() {
    .milkdown .ProseMirror p {
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--fg-primary-color);
      margin: 0;
    }
  }

  &.is-readonly {
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 8px 12px;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
  }
}
</style>
