<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  EditableArea,
  EditableCancelTrigger,
  EditableEditTrigger,
  EditableInput,
  EditablePreview,
  EditableRoot,
  EditableSubmitTrigger,
} from 'reka-ui'

interface Props {
  placeholder?: string
  readonly?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Введите текст...',
  readonly: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'submit', value: string): void
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <EditableRoot
    v-slot="{ isEditing }"
    v-model="model"
    :placeholder="placeholder"
    class="kit-editable-root"
    :class="{ 'is-readonly': props.readonly, 'is-disabled': props.disabled }"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :activation-mode="props.readonly ? 'none' : 'focus'"
    @submit="value => emit('submit', value || '')"
  >
    <EditableArea class="kit-editable-area">
      <EditablePreview />
      <EditableInput class="kit-editable-input" />
    </EditableArea>

    <div v-if="!props.readonly" class="kit-editable-controls">
      <EditableEditTrigger v-if="!isEditing" as-child>
        <button class="control-btn edit-btn">
          <Icon icon="mdi:pencil-outline" />
        </button>
      </EditableEditTrigger>
      <template v-else>
        <EditableSubmitTrigger as-child>
          <button class="control-btn submit-btn">
            <Icon icon="mdi:check" />
          </button>
        </EditableSubmitTrigger>
        <EditableCancelTrigger as-child>
          <button class="control-btn cancel-btn">
            <Icon icon="mdi:close" />
          </button>
        </EditableCancelTrigger>
      </template>
    </div>
  </EditableRoot>
</template>

<style scoped lang="scss">
.kit-editable-root {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  width: 100%;

  &[data-editing='true'] .kit-editable-area {
    background-color: rgba(255, 255, 255, 0.1);
  }

  &.is-readonly .kit-editable-area {
    cursor: default;
  }

  &:not(.is-readonly):not(.is-disabled) {
    .control-btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .submit-btn:hover {
      color: var(--fg-success-color);
    }
    .cancel-btn:hover {
      color: var(--fg-error-color);
    }

    &:not([data-editing='true']) .kit-editable-area:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
  }
}

.kit-editable-area {
  flex-grow: 1;
  min-width: 0;
  border-radius: var(--r-s);
  transition: background-color 0.2s ease;
  padding: 8px;
}

.kit-editable-input {
  background-color: transparent;
  border: none;
  outline: none;
  color: inherit;
  width: 100%;
  font-family: inherit;
  font-size: inherit;
  padding: 0;
}

:deep(.editable-preview) {
  p {
    margin: 0;
  }
}

.kit-editable-controls {
  display: flex;
  gap: 4px;

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--r-full);
    border: none;
    cursor: pointer;
    color: var(--fg-primary-color);
    background-color: transparent;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }
}
</style>
