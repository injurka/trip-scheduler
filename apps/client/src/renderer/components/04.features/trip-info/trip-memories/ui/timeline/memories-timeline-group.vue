<script setup lang="ts">
import type { Memory } from '~/shared/types/models/memory'
import { Icon } from '@iconify/vue'
import { Time } from '@internationalized/date'
import { onClickOutside } from '@vueuse/core'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
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

const emit = defineEmits<{ toggleCollapse: [] }>()

const { memories: memoriesStore, plan: tripPlanStore } = useModuleStore(['memories', 'plan'])
const confirm = useConfirm()

const isEditingTime = ref(false)
const timeEditorRef = ref(null)
const isEditingTitle = ref(false)
const editableTitle = ref('')
const titleEditorRef = ref(null)
const editableTime = shallowRef<Time | null>(null)

function handleTimeClick() {
  if (props.isViewMode || props.group.type !== 'activity' || !props.group.activity)
    return

  isEditingTime.value = true
  if (props.group.activity.timestamp) {
    editableTime.value = getTimeFromTimestamp(props.group.activity.timestamp)
  }
  else {
    const now = new Date()
    editableTime.value = new Time(now.getHours(), now.getMinutes())
  }
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
  if (!day || !day.date) {
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

const tagSolidColor = computed(() => {
  if (!tagInfo.value?.color)
    return undefined
  const c = tagInfo.value.color
  if (c.startsWith('#') && c.length === 9) {
    return c.slice(0, 7)
  }
  return c
})

const displayTime = computed(() => {
  if (!props.group.activity?.timestamp)
    return ''

  return formatTimestamp(props.group.activity.timestamp)
})

const photosCount = computed(() => props.group.memories.filter(m => m.imageId).length)
const notesCount = computed(() => props.group.memories.filter(m => !m.imageId).length)

function handleHeaderClick() {
  if (props.isFullScreen && props.isCollapsed) {
    emit('toggleCollapse')
  }
}

onClickOutside(timeEditorRef, saveTime)
onClickOutside(titleEditorRef, saveTitle)
</script>

<template>
  <div
    class="activity-timeline-node"
    :class="{ 'is-collapsed': isCollapsed, 'is-fullscreen-node': isFullScreen }"
  >
    <div
      class="activity-header"
      :class="{ 'is-fullscreen-header': isFullScreen }"
      @click="handleHeaderClick"
    >
      <div class="header-meta-group">
        <div
          v-if="group.type === 'activity'"
          class="activity-time"
          :class="{
            'is-editable': !isViewMode,
            'time-pill': isFullScreen,
            'is-empty': !displayTime,
          }"
          @click.stop="handleTimeClick"
        >
          <div v-if="isEditingTime" ref="timeEditorRef" class="time-editor-inline" @click.stop>
            <KitTimeField v-model="editableTime" />

            <button class="save-btn" @click="saveTime">
              <Icon icon="mdi:check" width="16" height="16" />
            </button>
          </div>
          <template v-else-if="isFullScreen">
            <Icon icon="mdi:clock-outline" class="time-pill-icon" />
            <span class="time-text">{{ displayTime || (isViewMode ? '—:—' : 'Задать время') }}</span>
            <Icon v-if="!isViewMode" icon="mdi:pencil-outline" class="time-edit-hint" />
          </template>
          <span v-else>{{ displayTime }}</span>
        </div>

        <div
          v-if="isFullScreen && tagInfo"
          class="fullscreen-tag-badge"
          :style="tagSolidColor ? { '--tag-color': tagSolidColor } : {}"
        >
          <span class="tag-dot" />
          <Icon :icon="tagInfo.icon" class="tag-icon" />
          <span class="tag-label">{{ tagInfo.label }}</span>
        </div>

        <div
          v-if="isFullScreen && group.activity?.sourceActivityId"
          class="fullscreen-imported-pill"
          title="Связано с активностью из плана поездки"
        >
          <Icon icon="mdi:import" class="imported-icon" />
          <span>Из плана</span>
        </div>

        <div v-if="isFullScreen && (photosCount > 0 || notesCount > 0)" class="memories-count-group">
          <span v-if="photosCount > 0" class="count-pill photos-pill" title="Количество фотографий и видео">
            <Icon icon="mdi:image-multiple-outline" class="count-icon" />
            <span>{{ photosCount }}</span>
          </span>
          <span v-if="notesCount > 0" class="count-pill notes-pill" title="Количество заметок">
            <Icon icon="mdi:note-text-outline" class="count-icon" />
            <span>{{ notesCount }}</span>
          </span>
        </div>

        <h5 v-if="group.type !== 'activity'" class="activity-title in-header">
          <Icon v-if="tagInfo" :icon="tagInfo.icon" class="title-icon" />
          {{ group.title }}
        </h5>
      </div>

      <div class="activity-header-actions" @click.stop>
        <KitTooltip v-if="!isViewMode && group.type === 'activity'" text="Удалить активность">
          <button
            class="delete-activity-btn"
            @click.stop="handleDeleteActivity"
          >
            <Icon icon="mdi:trash-can-outline" width="16" height="16" />
          </button>
        </KitTooltip>
        <KitTooltip :text="isCollapsed ? 'Развернуть активность' : 'Свернуть активность'">
          <button
            class="collapse-toggle-btn"
            :class="{ 'is-collapsed': isCollapsed }"
            @click.stop="emit('toggleCollapse')"
          >
            <Icon icon="mdi:chevron-up" class="collapse-icon" />
          </button>
        </KitTooltip>
      </div>
    </div>

    <h5
      v-if="group.type === 'activity'"
      class="activity-title"
      :class="{
        'is-editable': !isViewMode,
        'is-fullscreen-title': isFullScreen,
      }"
      @click="handleTitleClick"
    >
      <div v-if="isEditingTitle" ref="titleEditorRef" class="title-editor-wrapper" @click.stop>
        <KitInput v-model="editableTitle" class="title-editor" @keydown.enter="saveTitle" />
        <button class="save-btn" @click="saveTitle">
          <Icon icon="mdi:check" />
        </button>
      </div>
      <template v-else>
        <Icon v-if="tagInfo && !isFullScreen" :icon="tagInfo.icon" class="title-icon" />
        <span class="title-text">{{ group.title }}</span>
        <Icon
          v-if="!isViewMode && isFullScreen"
          icon="mdi:pencil-outline"
          class="title-edit-hint"
        />
      </template>
    </h5>

    <div v-show="!isCollapsed" class="collapsible-content">
      <div v-if="!isFullScreen && group.activity?.sourceActivityId" class="imported-badge">
        <Icon width="18" height="18" icon="mdi:import" />
        <span>Импортировано из плана</span>
      </div>

      <div
        v-if="isFullScreen && group.memories.length === 0"
        class="fullscreen-empty-memories"
      >
        <Icon icon="mdi:camera-plus-outline" class="empty-icon" />
        <div class="empty-text">
          <span class="empty-title">В этой активности пока нет воспоминаний</span>
          <span v-if="!isViewMode" class="empty-subtitle">Загрузите фото сверху или создайте заметку</span>
        </div>
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
    border-left: 3px solid var(--border-secondary-color);
    padding-left: 36px;
    padding-top: 16px;
    padding-bottom: 56px;
    transition:
      border-color 0.25s ease,
      padding-bottom 0.3s ease;

    @include media-down(sm) {
      padding-left: 18px;
      padding-bottom: 28px;
      padding-top: 12px;
    }

    &::before {
      width: 20px;
      height: 20px;
      left: -11.5px;
      top: 21px;
      border: 3px solid var(--border-secondary-color);
      background-color: var(--bg-primary-color);
      border-radius: 50%;
      transform: none;
      box-shadow:
        0 0 0 4px var(--bg-primary-color),
        0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    &:hover {
      border-left-color: var(--border-primary-color);

      &::before {
        border-color: var(--fg-accent-color);
        box-shadow:
          0 0 0 4px var(--bg-primary-color),
          0 0 14px rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.4);
        transform: scale(1.15);
      }
    }

    &.is-collapsed {
      padding-bottom: 16px;

      &::before {
        background-color: var(--border-secondary-color);
        transform: scale(0.9);
      }

      .activity-header {
        cursor: pointer;
      }
    }

    .activity-header-actions {
      .collapse-toggle-btn,
      .delete-activity-btn {
        width: 30px;
        height: 30px;
        box-sizing: border-box;
        border-radius: var(--r-full);
        background-color: var(--bg-secondary-color);
        border: 1px solid var(--border-secondary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-size: 16px;

        &:hover {
          background-color: var(--bg-hover-color);
          border-color: var(--border-primary-color);
        }
      }

      .delete-activity-btn:hover {
        border-color: var(--fg-error-color);
        color: var(--fg-error-color);
      }
    }
  }

  &::before {
    content: '';
    position: absolute;
    left: -14px;
    transform: rotate(45deg);
    top: 30px;
    width: 16px;
    height: 16px;
    background-color: var(--bg-primary-color);
    border: 3px solid var(--border-secondary-color);
  }
}

.activity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;

  &.is-fullscreen-header {
    margin-bottom: 8px;
    transition: background-color 0.2s ease;
  }
}

.header-meta-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.activity-header-actions {
  display: flex;
  gap: 6px;
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

  &.time-pill {
    height: 30px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-full);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1;
    white-space: nowrap;
    transition: all 0.2s ease;

    .time-pill-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--fg-secondary-color);
      flex-shrink: 0;
    }

    .time-text {
      line-height: 1;
    }

    .time-edit-hint {
      font-size: 14px;
      width: 14px;
      height: 14px;
      opacity: 0;
      color: var(--fg-secondary-color);
      transition: opacity 0.2s ease;
      margin-left: 2px;
      flex-shrink: 0;
    }

    &.is-empty {
      border-style: dashed;
      color: var(--fg-secondary-color);
      font-weight: 500;
    }

    &.is-editable:hover {
      background-color: var(--bg-hover-color);
      border-color: var(--border-primary-color);

      .time-edit-hint {
        opacity: 0.8;
      }
    }
  }
}

.fullscreen-tag-badge {
  height: 30px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-primary-color);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1;
  transition: all 0.2s ease;

  .tag-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--tag-color, var(--fg-accent-color));
    flex-shrink: 0;
    box-shadow: 0 0 8px var(--tag-color, var(--fg-accent-color));
  }

  .tag-icon {
    font-size: 16px;
    width: 16px;
    height: 16px;
    color: var(--tag-color, var(--fg-accent-color));
    flex-shrink: 0;
  }

  .tag-label {
    color: var(--fg-primary-color);
    font-weight: 600;
    line-height: 1;
  }

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
  }
}

.fullscreen-imported-pill {
  height: 30px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1;

  .imported-icon {
    font-size: 16px;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}

.memories-count-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  .count-pill {
    height: 30px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border-radius: var(--r-full);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    font-size: 0.82rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;

    .count-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
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

.collapse-toggle-btn {
  .collapse-icon {
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.is-collapsed .collapse-icon {
    transform: rotate(180deg);
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

  &.is-fullscreen-title {
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 8px 0 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--fg-primary-color);
    line-height: 1.3;
    transition: color 0.2s ease;

    .title-edit-hint {
      font-size: 1rem;
      opacity: 0;
      color: var(--fg-secondary-color);
      transition:
        opacity 0.2s ease,
        transform 0.2s ease;
    }

    &.is-editable {
      padding: 4px 8px;
      border-radius: var(--r-s);
      margin-left: -8px;

      &:hover {
        background-color: var(--bg-hover-color);

        .title-edit-hint {
          opacity: 0.8;
          transform: translateX(2px);
        }
      }
    }
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

.is-fullscreen-node .title-editor-wrapper {
  margin: 6px 0 16px;

  .title-editor :deep(input) {
    font-size: 1.35rem;
    font-weight: 700;
    height: 42px;
    padding: 6px 12px;
    border-radius: var(--r-s);
  }

  .save-btn {
    width: 32px;
    height: 32px;
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
    font-family: var(--font-accent);
    line-height: 34px;
  }
}

.fullscreen-empty-memories {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  border-radius: var(--r-m);
  border: 1px dashed var(--border-secondary-color);
  background-color: rgba(var(--bg-secondary-color-rgb, 30, 30, 30), 0.3);
  color: var(--fg-secondary-color);
  margin-bottom: 16px;

  .empty-icon {
    font-size: 2rem;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .empty-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .empty-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .empty-subtitle {
    font-size: 0.82rem;
    color: var(--fg-secondary-color);
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
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 20px;

    @media (max-width: 960px) {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }

    @media (max-width: 600px) {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    @media (min-width: 1920px) {
      grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
      gap: 24px;
    }
  }
}
</style>
