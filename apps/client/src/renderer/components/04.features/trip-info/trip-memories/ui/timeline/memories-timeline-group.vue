<script setup lang="ts">
import type { Time } from '@internationalized/date'
import type { Memory } from '~/shared/types/models/memory'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { useModuleStore } from '~/components/05.modules/trip-info'
import { getTagInfo } from '~/components/05.modules/trip-info/lib/helpers'
import MemoriesItem from './memories-timeline-item.vue'

interface TimelineGroup {
  type: 'start' | 'activity'
  title: string
  memories: Memory[]
  activity: Memory | null
}

interface Props {
  group: TimelineGroup
  isViewMode: boolean
  isCollapsed: boolean
  isFullScreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullScreen: false,
})

defineEmits<{ toggleCollapse: [] }>()

const { memories: memoriesStore, plan: tripPlanStore } = useModuleStore(['memories', 'plan'])
const confirm = useConfirm()

const isEditingTime = ref(false)
const timeEditorRef = ref(null)
const isEditingTitle = ref(false)
const editableTitle = ref('')
const titleEditorRef = ref(null)
const editableTime = shallowRef<Time | null>(null)

function handleTimeClick() {
  if (props.isViewMode || props.group.type !== 'activity' || !props.group.activity?.timestamp)
    return

  isEditingTime.value = true
  editableTime.value = getTimeFromTimestamp(props.group.activity.timestamp)
}

function handleTitleClick() {
  if (props.isViewMode || props.group.type !== 'activity' || !props.group.activity)
    return
  isEditingTitle.value = true
  editableTitle.value = props.group.title
}

function saveTime() {
  if (!isEditingTime.value || !editableTime.value || !props.group.activity) {
    isEditingTime.value = false
    return
  }
  const day = tripPlanStore.getSelectedDay
  if (!day) {
    isEditingTime.value = false
    return
  }
  const datePart = day.date.split('T')[0]
  const h = editableTime.value.hour.toString().padStart(2, '0')
  const m = editableTime.value.minute.toString().padStart(2, '0')
  const newTimestamp = `${datePart}T${h}:${m}:00.000Z`
  if (newTimestamp !== props.group.activity.timestamp)
    memoriesStore.updateMemory({ id: props.group.activity.id, timestamp: newTimestamp })
  isEditingTime.value = false
}

function saveTitle() {
  if (!isEditingTitle.value || !props.group.activity) {
    isEditingTitle.value = false
    return
  }
  const newTitle = editableTitle.value.trim()
  if (newTitle && newTitle !== props.group.title)
    memoriesStore.updateMemory({ id: props.group.activity.id, title: newTitle })
  isEditingTitle.value = false
}

async function handleDeleteActivity() {
  if (!props.group.activity)
    return
  const isConfirmed = await confirm({
    title: `Удалить «${props.group.title}»?`,
    description: 'Активность будет удалена без возможности восстановления.',
    type: 'danger',
    confirmText: 'Удалить',
  })
  if (isConfirmed)
    await memoriesStore.deleteMemory(props.group.activity.id)
}

const tagInfo = computed(() => {
  if (!props.group.activity?.tag)
    return null
  return getTagInfo(props.group.activity.tag)
})

const displayTime = computed(() => {
  if (!props.group.activity?.timestamp)
    return ''

  return formatTimestamp(props.group.activity.timestamp)
})

onClickOutside(timeEditorRef, saveTime)
onClickOutside(titleEditorRef, saveTitle)
</script>

<template>
  <div
    class="activity-timeline-node"
    :class="{ 'is-collapsed': isCollapsed, 'is-fullscreen-node': isFullScreen }"
  >
    <div class="activity-header">
      <div
        v-if="group.type === 'activity'"
        class="activity-time"
        :class="{ 'is-editable': !isViewMode }"
        @click="handleTimeClick"
      >
        <div v-if="isEditingTime" ref="timeEditorRef" class="time-editor-inline" @click.stop>
          <KitTimeField v-model="editableTime" />

          <button class="save-btn" @click="saveTime">
            <Icon icon="mdi:check" width="16" height="16" />
          </button>
        </div>
        <span v-else>{{ displayTime }}</span>
      </div>

      <h5 v-if="group.type !== 'activity'" class="activity-title in-header">
        <Icon v-if="tagInfo" :icon="tagInfo.icon" class="title-icon" />
        {{ group.title }}
      </h5>

      <div class="activity-header-actions">
        <button
          v-if="!isViewMode && group.type === 'activity'"
          class="delete-activity-btn"
          title="Удалить активность"
          @click.stop="handleDeleteActivity"
        >
          <Icon icon="mdi:trash-can-outline" width="16" height="16" />
        </button>
        <button class="collapse-toggle-btn" @click="$emit('toggleCollapse')">
          <Icon :icon="isCollapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
        </button>
      </div>
    </div>

    <h5
      v-if="group.type === 'activity'"
      class="activity-title"
      :class="{ 'is-editable': !isViewMode }"
      @click="handleTitleClick"
    >
      <div v-if="isEditingTitle" ref="titleEditorRef" class="title-editor-wrapper" @click.stop>
        <KitInput v-model="editableTitle" class="title-editor" @keydown.enter="saveTitle" />
        <button class="save-btn" @click="saveTitle">
          <Icon icon="mdi:check" />
        </button>
      </div>
      <template v-else>
        <Icon v-if="tagInfo" :icon="tagInfo.icon" class="title-icon" />
        {{ group.title }}
      </template>
    </h5>

    <div v-show="!isCollapsed" class="collapsible-content">
      <div v-if="group.activity?.sourceActivityId" class="imported-badge">
        <Icon width="18" height="18" icon="mdi:import" />
        <span>Импортировано из плана</span>
      </div>

      <div
        v-if="group.memories.length > 0"
        class="memories-for-activity"
        :class="{ 'fullscreen-grid': isFullScreen }"
      >
        <MemoriesItem
          v-for="memory in group.memories"
          :key="memory.id"
          :memory="memory"
          :is-view-mode="isViewMode"
          :is-full-screen="isFullScreen"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-timeline-node {
  position: relative;
  padding-left: 24px;
  border-left: 2px solid var(--border-secondary-color);
  padding-bottom: 24px;
  padding-top: 24px;
  transition: padding-bottom 0.3s ease;

  @include media-down(sm) {
    padding-left: 12px;
    padding-bottom: 12px;
    padding-top: 12px;
  }

  &.is-collapsed {
    padding-bottom: 0;
  }

  .activity-title:not(.in-header) {
    margin-bottom: 0;
  }

  &:not(:last-child) {
    border-left-style: dashed;
  }

  &.is-fullscreen-node {
    border-left: 4px solid var(--border-secondary-color);
    padding-left: 40px;
    padding-bottom: 64px;

    &::before {
      width: 24px;
      height: 24px;
      left: -14px;
      top: 34px;
      border-width: 5px;
    }

    .activity-title {
      font-size: 1.4rem;
      margin-bottom: 24px;
    }

    .activity-time span {
      font-size: 1.1rem;
    }
  }

  &::before {
    content: '';
    position: absolute;
    left: -9px;
    top: 30px;
    width: 16px;
    height: 16px;
    background-color: var(--bg-primary-color);
    border: 3px solid var(--border-secondary-color);
    border-radius: 50%;
  }
}

.activity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.activity-header-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
}

.activity-time {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  font-weight: 500;

  &.is-editable:hover {
    cursor: pointer;
    color: var(--fg-primary-color);
  }
}

.collapse-toggle-btn,
.delete-activity-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 4px;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.delete-activity-btn:hover {
  color: var(--fg-error-color);
  background-color: var(--bg-hover-color);
}

.activity-title {
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 12px;
  transition: margin-bottom 0.3s ease;

  &.is-editable {
    border-radius: var(--r-xs);

    &:hover {
      cursor: pointer;
      background-color: var(--bg-hover-color);
    }
  }

  &.in-header {
    margin: 0;
  }
}

.title-icon {
  font-size: 1.2rem;
  color: var(--fg-secondary-color);
}

.time-editor-inline {
  display: flex;
  align-items: center;
  gap: 4px;

  :deep(.kit-time-field) {
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-primary-color);
    padding: 0 4px;
    color: var(--fg-primary-color);
  }
}

.title-editor-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;

  .title-editor {
    flex-grow: 1;

    :deep(input) {
      font-size: 1rem;
      font-weight: 600;
      font-family: inherit;
      padding: 4px 8px;
      height: 32px;
    }
  }
}

.save-btn {
  background: var(--fg-accent-color);
  color: white;
  border-radius: 50%;
  padding: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
}

.imported-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  border-radius: var(--r-xs);
  margin-bottom: 20px;
  border: 1px solid var(--border-secondary-color);
  height: 34px;

  span {
    font-size: 0.75rem;
    font-family: Sansation;
    line-height: 34px;
  }
}

.memories-for-activity {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;

  @include media-down(sm) {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }

  &.fullscreen-grid {
    grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
    gap: 12px;
  }
}
</style>
