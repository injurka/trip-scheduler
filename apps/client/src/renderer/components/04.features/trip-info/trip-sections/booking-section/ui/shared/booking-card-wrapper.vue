<script setup lang="ts">
import type { HighlightStatus } from '../../composables/use-booking-section'
import { Icon } from '@iconify/vue'
import { KitEditable } from '~/components/01.kit/kit-editable'
import { vRipple } from '~/shared/directives/ripple'

interface Props {
  icon: string
  readonly: boolean
  highlightStatus?: HighlightStatus
}

const props = withDefaults(defineProps<Props>(), {
  highlightStatus: null,
})
const emit = defineEmits<{ (e: 'delete'): void }>()
const title = defineModel<string>('title', { required: true })
const confirm = useConfirm()

const isDetailsVisible = ref(false)

const highlightClass = computed(() => {
  if (!props.highlightStatus)
    return ''
  return `highlight-${props.highlightStatus}`
})

const statusBadge = computed(() => {
  switch (props.highlightStatus) {
    case 'active': return { text: 'Сейчас', icon: 'mdi:play-circle-outline', color: 'var(--fg-success-color)' }
    case 'next': return { text: 'Далее', icon: 'mdi:skip-next-circle-outline', color: 'var(--fg-info-color)' }
    case 'closest': return { text: 'Ближайшее', icon: 'mdi:clock-start', color: 'var(--fg-accent-color)' }
    default: return null
  }
})

function showVisibleIfClose() {
  if (!isDetailsVisible.value)
    isDetailsVisible.value = !isDetailsVisible.value
}

async function handleDelete() {
  const isConfirmed = await confirm({
    title: 'Подтвердите удаление',
    description: 'Вы уверены, что хотите удалить это бронирование? Это действие необратимо.',
    confirmText: 'Удалить',
    type: 'danger',
  })
  if (isConfirmed) {
    emit('delete')
  }
}
</script>

<template>
  <div class="booking-card" :class="highlightClass">
    <header v-ripple class="card-header" @click="isDetailsVisible = !isDetailsVisible">
      <div class="title-container">
        <button v-if="!readonly" class="drag-handle" title="Перетащить">
          <Icon icon="mdi:drag-vertical" />
        </button>
        <Icon :icon="icon" class="title-icon" />

        <span
          v-if="readonly"
          class="card-title"
        >
          {{ title }}
        </span>
        <KitEditable
          v-else
          v-model="title"
          :readonly="readonly"
          class="group-name"
          placeholder="Введите заголовок"
          @click.stop
        />

        <div v-if="statusBadge" class="status-badge" :style="{ color: statusBadge.color, borderColor: statusBadge.color }">
          <Icon :icon="statusBadge.icon" />
          <span>{{ statusBadge.text }}</span>
        </div>
      </div>
      <div class="card-actions">
        <button v-if="$slots.details" class="details-btn" title="Подробнее">
          <Icon :icon="isDetailsVisible ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </button>
        <button v-if="!readonly" class="delete-btn" title="Удалить" @click="handleDelete">
          <Icon icon="mdi:trash-can-outline" />
        </button>
      </div>
    </header>
    <div class="card-body" @click="showVisibleIfClose">
      <slot />

      <template v-if="$slots.details">
        <Transition name="fade-height">
          <div v-if="isDetailsVisible" class="details-content">
            <slot name="details" />
          </div>
        </Transition>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.booking-card {
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: var(--s-m);
  }

  &.highlight-active {
    border-color: var(--fg-success-color);
    box-shadow:
      0 0 0 1px var(--fg-success-color),
      var(--s-m);
    background-color: rgba(var(--fg-success-color-rgb), 0.03);
  }

  &.highlight-next {
    border-color: var(--fg-info-color);
    border-style: dashed;
    background-color: rgba(var(--fg-info-color-rgb), 0.02);
  }

  &.highlight-closest {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background-color: var(--bg-tertiary-color);
  border-bottom: 1px solid var(--border-secondary-color);

  .highlight-active & {
    background-color: rgba(var(--fg-success-color-rgb), 0.1);
    border-bottom-color: rgba(var(--fg-success-color-rgb), 0.2);
  }
  .highlight-next & {
    background-color: rgba(var(--fg-info-color-rgb), 0.1);
  }
  .highlight-closest & {
    background-color: rgba(var(--fg-accent-color-rgb), 0.1);
  }
}

.title-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-grow: 1;
  min-width: 0;
  margin-right: 8px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-full);
  border: 1px solid currentColor;
  background-color: var(--bg-primary-color);
  margin-left: auto;
  white-space: nowrap;

  @media (max-width: 600px) {
    span {
      display: none;
    }
  }
}

.title-icon {
  font-size: 1.25rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  min-height: 40px;
  display: flex;
  align-items: center;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.card-actions button {
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  transition: all 0.2s ease;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.delete-btn svg {
  color: var(--fg-error-color);
}

.drag-handle {
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
}

.card-body {
  padding: 0.75rem 1rem;
}

.details-content {
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fade-height-enter-active,
.fade-height-leave-active {
  transition: all 0.3s ease-in-out;
  overflow: hidden;
}
.fade-height-enter-from,
.fade-height-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  margin-top: 0;
}
.fade-height-enter-to,
.fade-height-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
