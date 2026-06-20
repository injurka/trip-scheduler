<script setup lang="ts">
import type { CustomActivitySection, SectionGroup } from '../models/types.ts'
import type { ActivitySectionGeolocation } from '~/components/03.domain/trip-info/geolocation-section/index.ts'
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
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { activityTagIcons, activityTagLabels, getTagInfo } from '~/components/05.modules/trip-info/lib/helpers'
import AddSectionMenu from '~/components/05.modules/trip-info/ui/controls/add-section-menu.vue'
import { EActivitySectionType, EActivityTag } from '~/shared/types/models/activity'
import { useActivityDiff } from '../composables/use-activity-diff'
import ActivitySectionRenderer from './sections/section-renderer.vue'
import LlmActivityEditor from './llm-activity-editor.vue'

interface ActivityItemProps {
  activity: Activity
  draft?: Activity | null
  isFirst: boolean
  isLast: boolean
  isCollapsed: boolean
  isPreviewMode?: boolean
}

const props = defineProps<ActivityItemProps>()
const emit = defineEmits<{
  (e: 'update', value: Activity): void
  (e: 'delete', value: string): void
  (e: 'moveUp'): void
  (e: 'moveDown'): void
  (e: 'toggleCollapse'): void
  (e: 'acceptDraft'): void
  (e: 'discardDraft'): void
  (e: 'requestAiEdit', prompt: string): void
  (e: 'acceptDraftFields', fields: string[]): void
}>()  

const store = useModuleStore(['ui'])
const { isViewMode } = storeToRefs(store.ui)
const isReadOnly = computed(() => isViewMode.value || !!props.isPreviewMode)

const isTimeEditing = ref(false)
const isAiEditing = ref(false)

const timeEditorRef = ref<HTMLElement | null>(null)
const activityTitle = ref(props.activity.title)
watch(() => props.activity.title, (newTitle) => {
  activityTitle.value = newTitle
}, { immediate: true })
const editingStartTime = shallowRef<Time | null>(null)
const editingEndTime = shallowRef<Time | null>(null)
const expandedSections = ref<Record<string, Record<string, boolean>>>({})

const isAccepting = ref(false)
const isDiscarding = ref(false)

const sectionTypeIcons: Record<EActivitySectionType, string> = {
  [EActivitySectionType.DESCRIPTION]: 'mdi:text-box-outline',
  [EActivitySectionType.GALLERY]: 'mdi:image-multiple-outline',
  [EActivitySectionType.GEOLOCATION]: 'mdi:map-marker-outline',
  [EActivitySectionType.METRO]: 'mdi:subway-variant',
}

const tagInfo = computed(() => getTagInfo(props.activity.tag))

// Diff вычисляем реактивно относительно draft-пропа
const activityDiff = computed(() => {
  if (!props.draft) return null
  const baseDiff = useActivityDiff(props.activity, props.draft)
  
  // Group startTime and endTime into a single 'time' field
  const timeField = baseDiff.changedFields.find(f => f.field === 'startTime' || f.field === 'endTime')
  const newChangedFields = baseDiff.changedFields.filter(f => f.field !== 'startTime' && f.field !== 'endTime')
  
  if (timeField) {
    newChangedFields.unshift({
      field: 'time',
      label: 'Время',
      original: `${props.activity.startTime || '—'} - ${props.activity.endTime || '—'}`,
      draft: `${props.draft.startTime || '—'} - ${props.draft.endTime || '—'}`,
      changed: true
    })
  }
  
  return {
    ...baseDiff,
    changedFields: newChangedFields
  }
})

const isDraftMode = computed(() => !!props.draft)

function handleAiGenerate({ prompt }: { prompt: string }) {
  emit('requestAiEdit', prompt)
}

function handleAccept() {
  isAccepting.value = true
  setTimeout(() => {
    emit('acceptDraft')
    isAccepting.value = false
  }, 300)
}

function handleDiscard() {
  isDiscarding.value = true
  setTimeout(() => {
    emit('discardDraft')
    isDiscarding.value = false
  }, 300)
}


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

function parseTime(timeStr?: string): Time {
  if (!timeStr)
    return new Time(0, 0)

  const [hour, minute] = timeStr.split(':').map(Number)

  return new Time(hour || 0, minute || 0)
}

function editTime() {
  if (isReadOnly.value)
    return

  isTimeEditing.value = true
  editingStartTime.value = parseTime(props.activity.startTime)
  editingEndTime.value = parseTime(props.activity.endTime)
}

function saveTimeChanges() {
  if (!isTimeEditing.value)
    return

  const startHour = (editingStartTime.value?.hour ?? 0).toString().padStart(2, '0')
  const startMinute = (editingStartTime.value?.minute ?? 0).toString().padStart(2, '0')
  const endHour = (editingEndTime.value?.hour ?? 0).toString().padStart(2, '0')
  const endMinute = (editingEndTime.value?.minute ?? 0).toString().padStart(2, '0')

  const newStartTime = `${startHour}:${startMinute}`
  const newEndTime = `${endHour}:${endMinute}`

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

function moveSection(sectionId: string, direction: 'up' | 'down') {
  const sections = [...(props.activity.sections || [])]
  const index = sections.findIndex(s => s.id === sectionId)

  if (index === -1)
    return

  if (direction === 'up') {
    if (index === 0)
      return
    const temp = sections[index]
    sections[index] = sections[index - 1]
    sections[index - 1] = temp
  }
  else {
    if (index === sections.length - 1)
      return
    const temp = sections[index]
    sections[index] = sections[index + 1]
    sections[index + 1] = temp
  }

  updateActivity({ sections })
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
  const isConfirmed = await (confirm as any)({
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
  <div
    class="activity-item"
    :class="{
      'view-mode': isReadOnly,
      'is-collapsed': isCollapsed,
      'is-draft': isDraftMode,
      'is-accepting': isAccepting,
      'is-discarding': isDiscarding
    }"
  >
    <div v-if="!isReadOnly" class="drag-handle" />

    <!-- Draft-баннер: компактная однострочная панель -->
    <div v-if="isDraftMode" class="draft-banner">
      <div class="draft-left">
        <KitTooltip :text="(draft ?? activity).explanation">
          <span class="draft-badge">
            <Icon icon="mdi:robot-outline" />
            AI
            <Icon v-if="(draft ?? activity).explanation" icon="mdi:information-outline" class="info-icon" />
          </span>
        </KitTooltip>
        <template v-if="activity.id.startsWith('new-ai-')">
          <span class="diff-chip diff-chip--added">
            <Icon icon="mdi:plus" /> Новая активность
          </span>
        </template>
        <template v-else>
          <!-- Дифф полей в виде чипов -->
          <span
            v-for="field in activityDiff?.changedFields"
            :key="field.field"
            class="diff-chip interactive-diff-chip"
          >
            <span>
              {{ field.label }}: <s>{{ field.original }}</s> → <b>{{ field.draft }}</b>
            </span>
            <KitTooltip text="Применить это изменение">
              <button 
                class="apply-field-btn" 
                :data-testid="`accept-field-${field.field}`" 
                @click.stop="emit('acceptDraftFields', [field.field === 'startTime' || field.field === 'endTime' ? 'time' : field.field])"
              >
                <Icon icon="mdi:check" />
              </button>
            </KitTooltip>
          </span>
          <span v-if="activityDiff?.sectionsAdded || activityDiff?.sectionsRemoved || activityDiff?.sectionsModified" class="diff-chip diff-chip--modified interactive-diff-chip">
            <span>
              Секции:
              <span v-if="activityDiff.sectionsAdded" class="text-success">+{{ activityDiff.sectionsAdded }}</span>
              <span v-if="activityDiff.sectionsModified" class="text-warning">~{{ activityDiff.sectionsModified }}</span>
              <span v-if="activityDiff.sectionsRemoved" class="text-danger">-{{ activityDiff.sectionsRemoved }}</span>
            </span>
            <KitTooltip text="Применить изменения в секциях">
              <button 
                class="apply-field-btn" 
                data-testid="accept-field-sections" 
                @click.stop="emit('acceptDraftFields', ['sections'])"
              >
                <Icon icon="mdi:check" />
              </button>
            </KitTooltip>
          </span>
          <span v-if="!activityDiff?.hasChanges" class="diff-chip diff-chip--none">
            Без изменений
          </span>
        </template>
      </div>
      <div class="draft-actions">
        <button class="draft-action-btn draft-action-btn--discard" @click="handleDiscard">
          <Icon icon="mdi:close" />
        </button>
        <button class="draft-action-btn draft-action-btn--accept" @click="handleAccept">
          <Icon icon="mdi:check" />
        </button>
      </div>
    </div>

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
              {{ (draft ?? activity).startTime }}
              <span>-</span>
              {{ (draft ?? activity).endTime }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="tagInfo || !isReadOnly" class="activity-tag-wrapper">
        <KitDropdown
          v-if="!isReadOnly"
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

      <button v-if="isReadOnly" class="collapse-toggle-btn" @click="$emit('toggleCollapse')">
        <Icon :icon="isCollapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
      </button>

      <div class="activity-controls">
        <KitTooltip text="Поднять вверх">
          <button
            class="control-btn"
            :disabled="isFirst"
            @click="$emit('moveUp')"
          >
            <Icon icon="mdi:arrow-up" />
          </button>
        </KitTooltip>
        <KitTooltip text="Опустить вниз">
          <button
            class="control-btn"
            :disabled="isLast"
            @click="$emit('moveDown')"
          >
            <Icon icon="mdi:arrow-down" />
          </button>
        </KitTooltip>
        <!-- Кнопка Редактировать с ИИ -->
        <KitTooltip v-if="!isReadOnly" text="Редактировать с ИИ">
          <button
            class="control-btn ai-btn"
            :class="{ active: isAiEditing }"
            @click="isAiEditing = !isAiEditing"
          >
            <Icon icon="mdi:robot-outline" />
          </button>
        </KitTooltip>
        <KitTooltip text="Удалить активность">
          <button
            class="control-btn delete-btn"
            @click="handleDelete"
          >
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </KitTooltip>
      </div>
    </div>

    <!-- Инлайн-редактор изменений через ИИ -->
    <LlmActivityEditor
      v-if="isAiEditing"
      :activity-title="activity.title"
      @generate="handleAiGenerate"
      @close="isAiEditing = false"
    />

    <div class="activity-title" :class="{ 'field-changed': activityDiff?.changedFields.some(f => f.field === 'title') }">
      <Icon icon="mdi:chevron-right" />
      <KitInlineMdEditorWrapper
        v-model="activityTitle"
        placeholder="Описание активности"
        :readonly="isReadOnly"
        class="activity-title-editor"
        :features="{ 'block-edit': false }"
        @blur="handleInlineEditorBlur"
      />
    </div>

    <div v-show="!isCollapsed || !isReadOnly" class="collapsible-content">
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
              @move-section-up="moveSection(group.parent.id, 'up')"
              @move-section-down="moveSection(group.parent.id, 'down')"
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
                    @move-section-up="moveSection(child.id, 'up')"
                    @move-section-down="moveSection(child.id, 'down')"
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
                      @move-section-up="moveSection(child.id, 'up')"
                      @move-section-down="moveSection(child.id, 'down')"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!isReadOnly" class="add-section-controls">
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

  /* Draft-mode styles */
  &.is-draft {
    border-radius: var(--r-s);
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 4px;
    padding: 8px;
    background: linear-gradient(135deg, rgba(var(--fg-accent-color-rgb), 0.03) 0%, transparent 100%);
    transition: all 0.3s ease;

    /* Скрыть вертикальную линию слева от итема */
    &::before {
      display: none;
    }

    /* Скрыть декоративную звёздочку перед временем (выше специфичность, через !important) */
    .activity-header .activity-time::before {
      content: none !important;
      display: none !important;
    }
  }

  &.is-accepting {
    transform: scale(1.02);
    box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
    outline-color: #22c55e;
    background: rgba(34, 197, 94, 0.05);
  }

  &.is-discarding {
    transform: scale(0.95);
    opacity: 0.5;
    outline-color: var(--fg-error-color);
  }

  .draft-banner {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    margin-bottom: 6px;
    background: rgba(var(--fg-accent-color-rgb), 0.05);
    border: 1px solid rgba(var(--fg-accent-color-rgb), 0.2);
    border-radius: var(--r-xs);
    font-size: 0.78rem;

    .draft-left {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
      flex-wrap: wrap;
    }

    .draft-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
      color: var(--fg-accent-color);
      font-size: 0.75rem;
      flex-shrink: 0;

      .info-icon {
        font-size: 0.8rem;
        opacity: 0.7;
        cursor: help;
      }
    }

    .diff-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 7px;
      border-radius: var(--r-full);
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      color: var(--fg-secondary-color);
      font-size: 0.73rem;
      white-space: nowrap;

      s { color: var(--fg-error-color); }
      b { color: var(--fg-success-color, #22c55e); font-weight: 600; }

      &--added { border-color: rgba(34, 197, 94, 0.3); color: #22c55e; }
      &--removed { border-color: rgba(var(--fg-error-color-rgb), 0.3); color: var(--fg-error-color); }
      &--modified { border-color: rgba(245, 158, 11, 0.3); color: #f59e0b; }
      &--none { opacity: 0.5; }
    }

    .interactive-diff-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px 2px 8px;
      border-radius: var(--r-full);
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      color: var(--fg-secondary-color);
      font-size: 0.73rem;
      white-space: nowrap;

      s { color: var(--fg-error-color); }
      b { color: var(--fg-success-color, #22c55e); font-weight: 600; }
      
      .text-success { color: var(--fg-success-color, #22c55e); font-weight: 600; }
      .text-warning { color: #f59e0b; font-weight: 600; }
      .text-danger { color: var(--fg-error-color); font-weight: 600; }

      .apply-field-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--fg-secondary-color);
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;

        &:hover {
          background: rgba(34, 197, 94, 0.2);
          color: var(--fg-success-color, #22c55e);
        }
      }
    }

    .draft-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .draft-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--r-full);
      border: 1px solid transparent;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.15s ease;
      background: transparent;

      &--discard {
        color: var(--fg-secondary-color);
        border-color: var(--border-secondary-color);
        &:hover { background: var(--bg-error-color); color: var(--fg-error-color); border-color: var(--border-error-color); }
      }
      &--accept {
        color: var(--fg-accent-color);
        border-color: var(--fg-accent-color);
        &:hover { background: var(--fg-accent-color); color: var(--fg-inverted-color); }
      }
    }
  }

  /* Подсветка измененных полей */
  .field-changed {
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -2px -4px;
      border-radius: var(--r-2xs);
      background: rgba(var(--fg-accent-color-rgb), 0.08);
      border: 1px solid rgba(var(--fg-accent-color-rgb), 0.25);
      pointer-events: none;
    }
  }

  /* Time diff */
  .time-old {
    color: var(--fg-error-color);
    text-decoration: line-through;
    opacity: 0.7;
    font-size: 0.85em;
  }
  .time-new {
    color: var(--fg-success-color, #22c55e);
    font-weight: 700;
  }
  .time-arrow {
    color: var(--fg-secondary-color);
    font-size: 0.85rem;
  }

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
      flex: 1;
      min-width: 0;
      overflow: hidden;
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
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
          padding: 0 4px;

          > span {
            margin: 0 2px;
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

        &.ai-btn {
          &:hover:not(:disabled) {
            color: var(--fg-accent-color);
            border-color: var(--fg-accent-color);
            background-color: rgba(var(--fg-accent-color-rgb), 0.08);
          }
          &.active {
            color: var(--fg-accent-color);
            border-color: var(--fg-accent-color);
            background-color: rgba(var(--fg-accent-color-rgb), 0.12);
          }
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
