<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  label: string
  icon?: string
  readonly: boolean
  disabled?: boolean
  placeholder?: string
  linkType?: 'web' | 'email' | 'tel'
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  disabled: false,
  placeholder: '...',
  linkType: undefined,
})

const modelValue = defineModel<string>()

const href = computed(() => {
  if (!props.linkType || !modelValue.value)
    return undefined

  switch (props.linkType) {
    case 'web': {
      if (modelValue.value.includes('.') && !modelValue.value.startsWith('http'))
        return `https://${modelValue.value}`

      return modelValue.value
    }
    case 'email':
      return `mailto:${modelValue.value}`
    case 'tel':
      // eslint-disable-next-line regexp/strict
      return `tel:${modelValue.value.replace(/[\s-()]/g, '')}`
    default:
      return undefined
  }
})
</script>

<template>
  <div class="booking-field">
    <div v-if="props.readonly" class="readonly-wrapper">
      <label class="field-label">
        {{ label }}
      </label>
      <div class="readonly-content">
        <Icon v-if="icon" :icon="icon" class="field-icon" />
        <a v-if="modelValue && linkType" :href="href" target="_blank" rel="noopener noreferrer" class="readonly-value link-value">{{ modelValue }}</a>
        <span v-else-if="modelValue" class="readonly-value">{{ modelValue }}</span>
        <span v-else class="readonly-placeholder">...</span>
      </div>
    </div>

    <KitInput
      v-else
      v-model="modelValue"
      :label="label"
      :icon="icon"
      :placeholder="placeholder"
      :disabled="disabled"
      size="sm"
    />
  </div>
</template>

<style scoped lang="scss">
.readonly-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-block: 2px;
}

.field-label {
  font-size: 0.725rem;
  margin-left: 2px;
  color: var(--fg-tertiary-color);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1.2;
}

.readonly-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  box-sizing: border-box;
  padding: 4px 10px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
}

.field-icon {
  font-size: 1rem;
  color: var(--booking-icon-color, var(--fg-accent-color));
  flex-shrink: 0;
}

.readonly-value {
  color: var(--fg-primary-color);
  line-height: 1.4;
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-break: break-word;

  &.link-value {
    text-decoration: underline;
    text-decoration-color: var(--border-secondary-color);
    transition: all 0.2s ease;
    cursor: pointer;

    &:hover {
      text-decoration-color: var(--fg-accent-color);
      color: var(--fg-accent-color);
    }
  }
}

.readonly-placeholder {
  color: var(--fg-tertiary-color);
}

.booking-field:deep(.kit-input-group) {
  gap: 2px;
}
.booking-field:deep(label) {
  font-size: 0.75rem;
  margin-left: 2px;
}
.booking-field:deep(input) {
  height: 36px;
  background-color: var(--bg-tertiary-color);
  &:focus {
    background-color: var(--bg-primary-color);
  }
}
.booking-field:deep(.input-icon-prefix) {
  color: var(--booking-icon-color, var(--fg-tertiary-color));
}
</style>
