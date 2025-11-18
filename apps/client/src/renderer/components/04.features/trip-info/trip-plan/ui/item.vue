<script setup lang="ts">
import type { CustomActivitySection, SectionGroup } from '../models/types.ts'
import type { ActivitySectionGeolocation } from '~/components/03.domain/trip-info/plan-geolocation-section'
import type {
  Activity,
  ActivitySection,
  ActivitySectionGallery,
  ActivitySectionMetro,
  ActivitySections,
  ActivitySectionText,
} from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { Time } from '@internationalized/date'
import { onClickOutside } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { activityTagIcons, activityTagLabels, getTagInfo } from '~/components/05.modules/trip-info/lib/helpers'
import AddSectionMenu from '~/components/05.modules/trip-info/ui/controls/add-section-menu.vue'
import { EActivitySectionType, EActivityTag } from '~/shared/types/models/activity'
import ActivitySectionRenderer from './sections/section-renderer.vue'

interface ActivityItemProps {
  activity: Activity
  isFirst: boolean
  isLast: boolean
  isCollapsed: boolean
}

const props = defineProps<ActivityItemProps>()
const emit = defineEmits<{
  (e: 'update', value: Activity): void
  (e: 'delete', value: string): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
  (e: 'toggleCollapse'): void
}>()

const store = useModuleStore(['ui'])
const { isViewMode } = storeToRefs(store.ui)
const confirm = useConfirm()

const isTimeEditing = ref(false)
const timeEditorRef = ref<HTMLElement | null>(null)
const activityTitle = ref(props.activity.title)
const editingStartTime = shallowRef<Time | null>(null)
const editingEndTime = shallowRef<Time | null>(null)
const expandedSections = ref<Record<string, Record<string, boolean>>>({})

const sectionTypeIcons: Record<EActivitySectionType, string> = {
  [EActivitySectionType.DESCRIPTION]: 'mdi:text-box-outline',
  [EActivitySectionType.GALLERY]: 'mdi:image-multiple-outline',
  [EActivitySectionType.GEOLOCATION]: 'mdi:map-marker-outline',
  [EActivitySectionType.METRO]: 'mdi:subway-variant',
}

const tagInfo = computed(() => getTagInfo(props.activity.tag))
const tagOptions = Object.values(EActivityTag).map(tag => ({
  value: tag,
  label: activityTagLabels[tag],
  icon: activityTagIcons[tag],
}))

function getContrastColor(hexcolor: string | undefined): string {
  if (!hexcolor)
    return '#000000'

  hexcolor = hexcolor.replace('#', '')
  if (hexcolor.length === 3)
    hexcolor = hexcolor.split('').map(char => char + char).join('')

  const r = Number.parseInt(hexcolor.substring(0, 2), 16)
  const g = Number.parseInt(hexcolor.substring(2, 4), 16)
  const b = Number.parseInt(hexcolor.substring(4, 6), 16)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
  return (yiq >= 128) ? '#000000' : '#FFFFFF'
}

function getTitledPinStyle(pin: CustomActivitySection) {
  const color = pin.color
  if (!color)
    return {}

  if (color.startsWith('var(')) {
    return {
      backgroundColor: color,
      borderColor: 'transparent',
    }
  }

  return {
    backgroundColor: `${color}33`,
    color: getContrastColor(color),
    borderColor: color,
  }
}

function getRegularPinStyle(pin: CustomActivitySection) {
  const color = pin.color
  if (!color)
    return {}

  if (color === 'var(--bg-secondary-color)' || color === 'var(--bg-tertiary-color)') {
    return {
      backgroundColor: color,
    }
  }

  if (color.startsWith('var(')) {
    return {
      backgroundColor: color,
    }
  }

  return {
    backgroundColor: `${color}33`,
    color: getContrastColor(color),
  }
}

function handleTagUpdate(newTag: EActivityTag) {
  updateActivity({ tag: newTag })
}

function getGroupedChildren(children: CustomActivitySection[]) {
  const withTitle: CustomActivitySection[] = []
  const withoutTitle: CustomActivitySection[] = []
  children.forEach((child) => {
    if (child.title)
      withTitle.push(child)
    else
      withoutTitle.push(child)
  })
  return { withTitle, withoutTitle }
}

function toggleSection(groupId: string, sectionId: string) {
  if (!expandedSections.value[groupId])
    expandedSections.value[groupId] = {}

  expandedSections.value[groupId][sectionId] = !isSectionExpanded(groupId, sectionId)
}

function updateActivity(newActivityData: Partial<Activity>) {
  emit('update', { ...props.activity, ...newActivityData })
}

function parseTime(timeStr: string): Time {
  const [hour, minute] = timeStr.split(':').map(Number)
  return new Time(hour, minute)
}

function editTime() {
  if (isViewMode.value)
    return

  isTimeEditing.value = true
  editingStartTime.value = parseTime(props.activity.startTime)
  editingEndTime.value = parseTime(props.activity.endTime)
}

function saveTimeChanges() {
  if (!isTimeEditing.value)
    return

  const newStartTime = `${editingStartTime.value?.hour.toString().padStart(2, '0')}:${editingStartTime.value?.minute.toString().padStart(2, '0')}`
  const newEndTime = `${editingEndTime.value?.hour.toString().padStart(2, '0')}:${editingEndTime.value?.minute.toString().padStart(2, '0')}`

  updateActivity({ startTime: newStartTime, endTime: newEndTime })
  isTimeEditing.value = false
}

function cancelTimeEditing() {
  isTimeEditing.value = false
}

function updateSection(sectionId: string, newSectionData: ActivitySection) {
  const newSections = [...(props.activity.sections || [])]
  const sectionIndex = newSections.findIndex(s => s.id === sectionId)

  if (sectionIndex !== -1) {
    (newSections[sectionIndex] as ActivitySection) = newSectionData
    updateActivity({ sections: newSections })
  }
}

function addSection(type: EActivitySectionType) {
  let newSection: ActivitySection

  switch (type) {
    case EActivitySectionType.DESCRIPTION:
      newSection = {
        id: uuidv4(),
        type: EActivitySectionType.DESCRIPTION,
        text: '',
      } as ActivitySectionText
      break
    case EActivitySectionType.GALLERY:
      newSection = {
        id: uuidv4(),
        type: EActivitySectionType.GALLERY,
        imageUrls: [],
      } as ActivitySectionGallery
      break
    case EActivitySectionType.GEOLOCATION:
      newSection = {
        id: uuidv4(),
        type: EActivitySectionType.GEOLOCATION,
        points: [],
        routes: [],
        drawnRoutes: [],
      } as ActivitySectionGeolocation
      break
    case EActivitySectionType.METRO:
      newSection = {
        id: uuidv4(),
        type: EActivitySectionType.METRO,
        mode: 'free',
        city: null,
        systemId: null,
        rides: [
          {
            id: uuidv4(),
            startStation: 'Начальная станция',
            endStation: 'Станция пересадки',
            lineName: 'Линия 1',
            lineColor: '#E53935', // red
            lineNumber: null,
            direction: 'На север',
            stops: 2,
            endStationId: null,
            lineId: null,
            startStationId: null,
          },
          {
            id: uuidv4(),
            startStation: 'Станция пересадки',
            endStation: 'Конечная станция',
            lineName: 'Линия 2',
            lineColor: '#1E88E5', // blue
            lineNumber: null,
            direction: 'На запад',
            stops: 3,
            endStationId: null,
            lineId: null,
            startStationId: null,
          },
        ],
      } as ActivitySectionMetro
      break
    default:
      return
  }
  const newSections = [...(props.activity.sections || []), newSection]
  updateActivity({ sections: newSections as ActivitySections })
}

function deleteSection(sectionId: string) {
  const newSections = (props.activity.sections || []).filter(s => s.id !== sectionId)
  updateActivity({ sections: newSections })
}

const sectionGroups = computed((): SectionGroup[] => {
  const groups: SectionGroup[] = []
  const sections = (props.activity.sections || []) as CustomActivitySection[]
  let i = 0

  while (i < sections.length) {
    const currentSection = sections[i]

    if (!currentSection.isAttached) {
      const attachedChildren: CustomActivitySection[] = []
      let j = i + 1

      while (j < sections.length && sections[j].isAttached) {
        attachedChildren.push(sections[j])
        j++
      }
      groups.push({ parent: currentSection, children: attachedChildren })
      i = j
    }
    else {
      groups.push({ parent: currentSection, children: [] })
      i++
    }
  }
  return groups
})

function isSectionExpanded(groupId: string, sectionId: string): boolean {
  return expandedSections.value[groupId]?.[sectionId] ?? false
}

function handleInlineEditorBlur() {
  updateActivity({ title: activityTitle.value })
}

async function handleDelete() {
  const isConfirmed = await confirm({
    title: 'Удалить активность?',
    description: 'Это действие необратимо. Все секции внутри этой активности будут удалены.',
    type: 'danger',
    confirmText: 'Удалить',
  })

  if (isConfirmed) {
    emit('delete', props.activity.id)
  }
}

onClickOutside(timeEditorRef, saveTimeChanges)
</script>

<template>
  <div class="activity-item" :class="{ 'view-mode': isViewMode, 'is-collapsed': isCollapsed }">
    <div v-if="!isViewMode" class="drag-handle" />

    <div class="activity-header">
      <div class="activity-time-wrapper">
        <div class="activity-time">
          <div v-if="isTimeEditing" ref="timeEditorRef" class="time-editor" @keydown.esc.prevent="cancelTimeEditing">
            <KitTimeField v-model="editingStartTime" />
            <span class="time-separator">-</span>
            <KitTimeField v-model="editingEndTime" />
          </div>
          <div v-else class="time-display" @click="editTime">
            <div class="time-display-preview">
              {{ activity.startTime }}
              <span>-</span>
              {{ activity.endTime }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="tagInfo || !isViewMode" class="activity-tag-wrapper">
        <KitDropdown
          v-if="!isViewMode"
          :items="tagOptions"
          :model-value="activity.tag"
          @update:model-value="handleTagUpdate"
        >
          <template #trigger>
            <button class="tag-chip" :style="{ backgroundColor: tagInfo?.color }">
              <Icon v-if="tagInfo" :icon="tagInfo.icon" />
              <span class="tag-chip-label">{{ tagInfo ? tagInfo.label : 'Выбрать тег' }}</span>
              <Icon icon="mdi:chevron-down" class="chevron" />
            </button>
          </template>
        </KitDropdown>
        <div v-else-if="tagInfo" class="tag-chip view-only" :style="{ backgroundColor: tagInfo.color }">
          <Icon :icon="tagInfo.icon" />
          <span class="tag-chip-label">{{ tagInfo.label }}</span>
        </div>
      </div>

      <button v-if="isViewMode" class="collapse-toggle-btn" @click="$emit('toggleCollapse')">
        <Icon :icon="isCollapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </button>

      <div class="activity-controls">
        <button
          class="control-btn"
          title="Поднять вверх"
          :disabled="isFirst"
          @click="$emit('moveUp')"
        >
          <Icon icon="mdi:arrow-up" />
        </button>
        <button
          class="control-btn"
          title="Опустить вниз"
          :disabled="isLast"
          @click="$emit('moveDown')"
        >
          <Icon icon="mdi:arrow-down" />
        </button>
        <button
          class="control-btn delete-btn"
          title="Удалить активность"
          @click="handleDelete"
        >
          <Icon icon="mdi:trash-can-outline" />
        </button>
      </div>
    </div>

    <div class="activity-title">
      <Icon icon="mdi:chevron-right" />
      <KitInlineMdEditorWrapper
        v-model="activityTitle"
        placeholder="Описание активности"
        :readonly="isViewMode"
        class="activity-title-editor"
        :features="{ 'block-edit': false }"
        @blur="handleInlineEditorBlur"
      />
    </div>

    <div v-show="!isCollapsed || !isViewMode" class="collapsible-content">
      <div class="activity-sections">
        <div v-if="sectionGroups.length > 0" class="sections-list">
          <div
            v-for="group in sectionGroups"
            :key="group.parent.id"
            class="section-group"
            :class="{ 'has-children': group.children.length > 0 }"
          >
            <ActivitySectionRenderer
              :section="group.parent"
              :is-first-attached="false"
              @update-section="newSectionData => updateSection(group.parent.id, newSectionData)"
              @delete-section="deleteSection(group.parent.id)"
            />

            <div v-if="group.children.length > 0" class="attached-items-container">
              <div
                v-for="(child, index) in getGroupedChildren(group.children).withTitle"
                :key="child.id"
                class="titled-pin-block"
              >
                <div class="titled-pin-wrapper">
                  <div class="attachment-line-start" />
                  <button
                    class="attached-pill titled-pin"
                    :class="{ active: isSectionExpanded(group.parent.id, child.id) }"
                    :style="getTitledPinStyle(child)"
                    @click="toggleSection(group.parent.id, child.id)"
                  >
                    <Icon width="18" height="18" :icon="child.icon || sectionTypeIcons[child.type]" class="pill-icon" />
                    <span class="pill-title">{{ child.title }}</span>
                    <Icon width="18" height="18" :icon="isSectionExpanded(group.parent.id, child.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="pill-chevron" />
                  </button>
                  <div v-if="index < getGroupedChildren(group.children).withTitle.length - 1 || getGroupedChildren(group.children).withoutTitle.length > 0" class="attachment-line-end" />
                </div>
                <div v-if="isSectionExpanded(group.parent.id, child.id)" class="expanded-pin-content">
                  <ActivitySectionRenderer
                    :section="child"
                    :is-first-attached="true"
                    @update-section="newSectionData => updateSection(child.id, newSectionData)"
                    @delete-section="deleteSection(child.id)"
                  />
                </div>
              </div>

              <div v-if="getGroupedChildren(group.children).withoutTitle.length > 0">
                <div class="regular-pins-wrapper">
                  <div class="attachment-line-start" />
                  <div class="attached-pills">
                    <button
                      v-for="child in getGroupedChildren(group.children).withoutTitle"
                      :key="child.id"
                      class="attached-pill"
                      :class="{ active: isSectionExpanded(group.parent.id, child.id) }"
                      :style="getRegularPinStyle(child)"
                      @click="toggleSection(group.parent.id, child.id)"
                    >
                      <Icon
                        width="18"
                        height="18"
                        :icon="child.icon || sectionTypeIcons[child.type]"
                        class="pill-icon"
                      />
                    </button>
                  </div>
                </div>
                <div
                  v-for="child in getGroupedChildren(group.children).withoutTitle"
                  :key="child.id"
                >
                  <div v-if="isSectionExpanded(group.parent.id, child.id)" class="expanded-pin-content">
                    <ActivitySectionRenderer
                      :section="child"
                      :is-first-attached="true"
                      @update-section="newSectionData => updateSection(child.id, newSectionData)"
                      @delete-section="deleteSection(child.id)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!isViewMode" class="add-section-controls">
          <AddSectionMenu @add-section="addSection" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
  transition: all 0.3s ease;
  margin: 32px 0;

  &.is-collapsed {
    margin-bottom: 0;

    .activity-title {
      > .iconify {
        display: none;
      }
      :deep(.milkdown) > div {
        padding-top: 0;
        padding-bottom: 0;
      }
    }

    &::before {
      display: none;
    }
  }

  &:hover {
    &::before {
      background-color: var(--fg-accent-color);
    }
  }

  .drag-handle {
    position: absolute;
    left: -19px;
    width: 18px;
    top: 50%;
    height: 100%;
    transform: translateY(-50%);
    cursor: grab;
    padding: 8px;
    &:active {
      cursor: grabbing;
    }
  }

  .activity-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background-color 0.2s ease;
    border-radius: var(--r-xs);
    gap: 4px;

    .activity-time-wrapper {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .collapse-toggle-btn {
      background: none;
      border: 1px solid transparent;
      cursor: pointer;
      color: var(--fg-secondary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
      transition: all 0.2s ease;
      font-size: 1.2rem;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      opacity: 0.5;

      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
        opacity: 1;
      }
    }

    &:hover {
      background-color: var(--bg-secondary-color);
    }

    .activity-time {
      position: relative;
      font-weight: 600;
      color: var(--fg-accent-color);
      padding: 4px 0;

      &::before {
        position: absolute;
        left: -15px;
        top: 4px;
        content: '✦';
        font-size: 0.8rem;
        color: var(--fg-secondary-color);
        opacity: 0.5;
        transition:
          color 0.2s ease,
          opacity 0.2s ease;
      }
      .time-display {
        cursor: pointer;
        padding: 2px 4px;
        margin: -2px -4px;
        border-radius: var(--r-2xs);
        transition: background-color 0.2s ease;

        &-preview {
          padding: 0 4px;

          > span {
            margin: 0 5px;
          }
        }
      }
      .time-editor {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }

    .activity-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease-in-out;

      .control-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: var(--r-full);
        background: transparent;
        border: 1px solid var(--border-secondary-color);
        color: var(--fg-secondary-color);
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
          background-color: var(--bg-hover-color);
          color: var(--fg-primary-color);
          border-color: var(--border-primary-color);
        }

        &.delete-btn:hover:not(:disabled) {
          background-color: var(--bg-error-color);
          color: var(--fg-error-color);
          border-color: var(--border-error-color);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }
  }

  .activity-title {
    display: flex;
    margin-top: 4px;
    gap: 4px;
    transition: margin 0.3s ease;

    .iconify {
      height: 24px;
      opacity: 0.5;
      color: var(--fg-secondary-color);
      transition: display 0.3s ease;
    }

    &-editor {
      width: 100%;
      :deep(.milkdown) {
        * {
          font-weight: 500;
          font-size: 1.1rem;
        }
        > div {
          margin: 0;
          padding: 0;
          transition: padding 0.3s ease;
        }
      }
    }
  }

  .collapsible-content {
    transition: all 0.3s ease-in-out;
  }

  .activity-sections {
    margin-top: 12px;
    padding-left: 8px;
  }

  .sections-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .section-group {
    position: relative;
  }

  .attached-items-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding-left: 16px;
    position: relative;
  }

  .titled-pin-wrapper,
  .regular-pins-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .attachment-line-start {
    position: absolute;
    left: -10px;
    top: -8px;
    width: 10px;
    height: 25px;
    border-left: 2px solid var(--border-secondary-color);
    border-bottom: 2px solid var(--border-secondary-color);
    border-bottom-left-radius: 6px;
  }
  .attachment-line-end {
    position: absolute;
    left: -10px;
    top: 12px;
    width: 10px;
    height: 100%;
    border-left: 2px solid var(--border-secondary-color);
  }

  .attached-pills {
    display: flex;
    gap: 8px;
    background: var(--bg-secondary-color);
    padding: 4px;
    border-radius: var(--r-l);
    border: 1px solid var(--border-secondary-color);
  }

  .attached-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--r-full);
    border: 1px solid transparent;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 4px;

    &.active {
      box-shadow:
        0 0 0 2px var(--bg-primary-color),
        0 0 0 4px var(--fg-accent-color);
      border-color: var(--fg-accent-color);
    }

    &.active:not(.titled-pin) {
      &:not([style*='background-color: var']) {
        background: var(--fg-accent-color);
        color: var(--fg-inverted-color);
      }
    }
    &:active {
      &:not([style*='background-color']) {
        background-color: var(--bg-tertiary-color);
      }
    }
    &:hover {
      background: var(--bg-hover-color);
      color: var(--fg-accent-color);
    }
  }

  .expanded-pin-content {
    margin-top: 12px;
    position: relative;
  }

  .titled-pin {
    width: auto;
    height: auto;
    padding: 6px 12px;
    gap: 8px;
    border-radius: var(--r-l);
    backdrop-filter: blur(4px);
    border: 1px solid;

    .pill-title {
      font-size: 0.8rem;
      font-weight: 500;
    }
    .pill-chevron {
      font-size: 0.9rem;
      margin-left: 4px;
    }
    &.active {
      box-shadow:
        0 0 0 2px var(--bg-primary-color),
        0 0 0 4px var(--fg-accent-color);
      border-color: var(--fg-accent-color) !important;
    }
    &-block {
      .expanded-pin-content {
        &::before {
          content: '';
          position: absolute;
          left: -10px;
          top: 0;
          bottom: 0;
          width: 2px;
          border: 1px dashed var(--border-secondary-color);
          background-color: transparent;
        }

        .is-attached {
          padding-left: 0px;
          border-left: 0;
        }
      }
    }
  }

  &.view-mode {
    .time-display {
      cursor: default !important;
      &:hover {
        background-color: transparent !important;
      }
    }

    &:hover {
      .activity-header .activity-time::before {
        color: var(--fg-secondary-color);
      }
    }
    .activity-header .activity-controls {
      display: none;
    }
    .sections-list {
      margin-bottom: 0;
    }
  }

  &::before {
    position: absolute;
    left: -10px;
    top: 30px;
    content: '';
    height: calc(100% - 30px);
    width: 2px;
    background-color: var(--border-secondary-color);
    transition: background-color 0.2s ease;
  }
}

.activity-tag-wrapper {
  display: flex;
  align-items: center;
  margin-left: auto;

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0px 10px;
    border-radius: var(--r-full);
    font-size: 0.8rem;
    font-weight: 500;
    border: 1px solid var(--border-secondary-color);
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--fg-primary-color);
    line-height: 24px;
    backdrop-filter: blur(4px);

    .chevron {
      font-size: 1rem;
      opacity: 0.6;
      margin-left: 2px;
    }

    &:hover {
      border-color: var(--border-accent-color);
    }

    &.view-only {
      cursor: default;

      &:hover {
        transform: none;
        border-color: var(--border-secondary-color);
      }
    }
  }
}

:deep(.kit-dropdown-content) {
  min-width: 220px;
}

@include media-down(sm) {
  .activity-item:not(.view-mode) .activity-tag-wrapper .tag-chip {
    width: 28px;
    height: 28px;
    padding: 0;
    justify-content: center;
    gap: 0;

    .tag-chip-label,
    .chevron {
      display: none;
    }
  }

  .activity-item {
    .activity-sections {
      padding-left: 0;
    }
    .expanded-pin-content {
      padding-left: 0;
    }
    .activity-section-renderer {
      &.is-attached {
        padding-left: 4px;
      }
    }
  }
}
</style>
