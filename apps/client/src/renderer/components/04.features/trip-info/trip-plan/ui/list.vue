<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { Icon } from '@iconify/vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import AddDayActivity from '~/components/05.modules/trip-info/ui/controls/add-day-activity.vue'
import { trpc } from '~/shared/services/trpc/trpc.service'
import ActivityItem from './item.vue'
import LlmCanvasAssistant from './llm-canvas-assistant.vue'
import { useToast } from '~/shared/composables/use-toast'

const emit = defineEmits<{
  (e: 'add'): void
}>()

const toast = useToast()

const { plan: data, ui } = useModuleStore(['plan', 'ui'])

const {
  getActivitiesForSelectedDay,
  hasDraftForDay,
  getSelectedDay,
  isPreviewMode,
} = storeToRefs(data)

function getDraftForActivity(activityId: string) {
  return data.getDraftForActivity(activityId)
}
const {
  reorderActivities,
  updateActivity,
  removeActivity,
  setActivityDraft,
  acceptActivityDraft,
  discardActivityDraft,
  acceptAllDraftsForDay,
  discardAllDraftsForDay,
  setPreviewMode,
  acceptActivityDraftFields,
} = data
const { isViewMode } = storeToRefs(ui)
const { collapsedActivities } = storeToRefs(ui)

function onUpdateActivity(updatedActivity: IActivity) {
  updateActivity(getSelectedDay.value!.id, updatedActivity)
}

function onDeleteActivity(activityId: string) {
  removeActivity(getSelectedDay.value!.id, activityId)
}

function onMoveActivity(activity: IActivity, direction: 'up' | 'down') {
  const activities = [...getActivitiesForSelectedDay.value]
  const currentIndex = activities.findIndex(a => a.id === activity.id)

  if (direction === 'up' && currentIndex > 0) {
    [activities[currentIndex], activities[currentIndex - 1]] = [activities[currentIndex - 1], activities[currentIndex]]
    reorderActivities(activities)
  }
  else if (direction === 'down' && currentIndex < activities.length - 1) {
    [activities[currentIndex], activities[currentIndex + 1]] = [activities[currentIndex + 1], activities[currentIndex]]
    reorderActivities(activities)
  }
}

const draggableActivities = computed({
  get: () => getActivitiesForSelectedDay.value,
  set: (newOrder: IActivity[]) => {
    if (!hasDraftForDay.value) {
      reorderActivities(newOrder)
    }
  },
})

const assistantRef = ref<InstanceType<typeof LlmCanvasAssistant> | null>(null)
const isGeneratingGlobal = ref(false)

function buildDaysContext(excludeDayId: string) {
  return data.getAllDays
    .filter(d => d.id !== excludeDayId)
    .map((d, _) => ({
      dayNumber: data.days.findIndex(x => x.id === d.id) + 1,
      date: typeof d.date === 'string' ? d.date.split('T')[0] : d.date.toISOString().split('T')[0],
      title: d.title || '',
      description: d.description ?? null,
      activitiesSummary: d.activities
        .filter(a => !a.id.startsWith('new-ai-'))
        .map(a => ({ startTime: a.startTime, endTime: a.endTime, title: a.title, tag: a.tag })),
    }))
}

async function handleGlobalGenerate({ prompt, useDaysContext, useCanvasAsRef }: { prompt: string, useDaysContext: boolean, useCanvasAsRef: boolean }) {
  if (!getSelectedDay.value)
    return
  isGeneratingGlobal.value = true

  try {
    const updatedActivities = await trpc.day.generateTemplate.mutate({
      dayId: getSelectedDay.value.id,
      prompt,
      currentActivities: getActivitiesForSelectedDay.value,
      canvasNote: useCanvasAsRef ? (data.getNoteForCurrentDay || undefined) : undefined,
      daysContext: useDaysContext ? buildDaysContext(getSelectedDay.value.id) : undefined,
    })

    // Разносим по отдельным драфтам, чтобы поблочное подтверждение работало
    const origIds = new Set(getActivitiesForSelectedDay.value.map(a => a.id))
    for (const updatedActivity of updatedActivities as IActivity[]) {
      if (origIds.has(updatedActivity.id)) {
        setActivityDraft(updatedActivity.id, updatedActivity)
      }
      else {
        const tempId = `new-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newActivity = { ...updatedActivity, id: tempId, dayId: getSelectedDay.value.id }
        getSelectedDay.value.activities.push(newActivity)
        setActivityDraft(tempId, newActivity)
      }
    }
  }
  catch (error: any) {
    console.error('Global template generation failed:', error)
    toast.error(error?.message || 'Ошибка генерации')
  }
  finally {
    isGeneratingGlobal.value = false
    assistantRef.value?.finishGeneration()
  }
}

const generatingActivityId = ref<string | null>(null)

async function handleActivityAiEdit(activity: IActivity, prompt: string) {
  if (!getSelectedDay.value)
    return
  generatingActivityId.value = activity.id

  try {
    const updatedActivities = await trpc.day.generateTemplate.mutate({
      dayId: getSelectedDay.value.id,
      prompt,
      currentActivities: [activity],
    })

    const updatedActivity = (updatedActivities as IActivity[])[0]
    if (updatedActivity) {
      setActivityDraft(activity.id, { ...updatedActivity, id: activity.id })
    }
  }
  catch (error: any) {
    console.error('Activity AI edit failed:', error)
    toast.error(error?.message || 'Ошибка обновления')
  }
  finally {
    generatingActivityId.value = null
  }
}

function onAcceptActivityDraft(activityId: string) {
  if (!getSelectedDay.value)
    return
  acceptActivityDraft(getSelectedDay.value.id, activityId)
}

function onDiscardActivityDraft(activityId: string) {
  discardActivityDraft(activityId)
}

function onAcceptActivityDraftFields(activityId: string, fields: string[]) {
  if (!getSelectedDay.value)
    return
  acceptActivityDraftFields(getSelectedDay.value.id, activityId, fields)
}

function acceptAll() {
  if (getSelectedDay.value)
    acceptAllDraftsForDay(getSelectedDay.value.id)
}

const undoDayId = ref<string | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | null = null

function discardAll() {
  if (getSelectedDay.value) {
    const dayId = getSelectedDay.value.id
    discardAllDraftsForDay(dayId)

    undoDayId.value = dayId
    if (undoTimer)
      clearTimeout(undoTimer)
    undoTimer = setTimeout(() => {
      undoDayId.value = null
    }, 5000)
  }
}

function handleUndo() {
  if (undoDayId.value) {
    data.undoDiscardAllDraftsForDay(undoDayId.value)
    undoDayId.value = null
    if (undoTimer)
      clearTimeout(undoTimer)
  }
}
</script>

<template>
  <div class="day-activities">
    <LlmCanvasAssistant v-if="!isViewMode" ref="assistantRef" :is-external-generating="isGeneratingGlobal" @generate="handleGlobalGenerate" />

    <div v-if="isGeneratingGlobal" class="draft-loading">
      <Icon icon="mdi:loading" class="spin-icon draft-spinner" />
      <span>Нейросеть анализирует день и генерирует изменения...</span>
    </div>

    <div v-if="hasDraftForDay && !isGeneratingGlobal" class="global-draft-header">
      <div class="global-draft-info">
        <Icon icon="mdi:eye-check-outline" />
        <span>Есть черновики ИИ — проверьте каждую активность</span>
      </div>
      <div class="mode-group mr-2" data-testid="preview-mode-toggle-group">
        <KitBtn
          size="sm"
          variant="outlined"
          color="secondary"
          :class="{ active: !isPreviewMode }"
          @click="setPreviewMode(false)"
        >
          Оригинал
        </KitBtn>
        <KitBtn
          size="sm"
          variant="outlined"
          color="secondary"
          :class="{ active: isPreviewMode }"
          @click="setPreviewMode(true)"
        >
          Превью с ИИ
        </KitBtn>
      </div>
      <div class="global-draft-actions">
        <KitBtn variant="text" color="secondary" size="sm" @click="discardAll">
          Отклонить все
        </KitBtn>
        <KitBtn color="primary" size="sm" @click="acceptAll">
          Принять все
        </KitBtn>
      </div>
    </div>

    <div v-show="!isGeneratingGlobal" class="activities-container">
      <draggable
        v-model="draggableActivities"
        ghost-class="ghost-activity"
        chosen-class="chosen-activity"
        animation="300"
        item-key="id"
        handle=".drag-handle"
        :disabled="isViewMode || hasDraftForDay"
        class="draggable-area"
      >
        <template #item="{ element: activity, index }">
          <ActivityItem
            :activity="activity"
            :draft="isPreviewMode ? null : getDraftForActivity(activity.id)"
            :is-preview-mode="isPreviewMode"
            :is-first="index === 0"
            :is-last="index === draggableActivities.length - 1"
            :is-collapsed="collapsedActivities.has(activity.id)"
            @update="onUpdateActivity"
            @delete="onDeleteActivity"
            @move-up="onMoveActivity(activity, 'up')"
            @move-down="onMoveActivity(activity, 'down')"
            @toggle-collapse="ui.toggleActivityCollapsed(activity.id)"
            @accept-draft="onAcceptActivityDraft(activity.id)"
            @discard-draft="onDiscardActivityDraft(activity.id)"
            @accept-draft-fields="fields => onAcceptActivityDraftFields(activity.id, fields)"
            @request-ai-edit="(prompt) => handleActivityAiEdit(activity, prompt)"
          />
        </template>
      </draggable>

      <div v-if="getActivitiesForSelectedDay.length === 0" class="empty-state">
        <p>На этот день нет запланированных активностей</p>
        <div v-if="!isViewMode" class="empty-state-actions">
          <KitBtn variant="outlined" size="sm" @click="handleGlobalGenerate({ prompt: 'Сгенерируй расписание на основе Полотна', useDaysContext: assistantRef?.useDaysContext ?? false, useCanvasAsRef: true })">
            <Icon icon="mdi:magic-staff" /> По Полотну
          </KitBtn>
          <KitBtn variant="outlined" size="sm" @click="handleGlobalGenerate({ prompt: 'Заполни день классическими достопримечательностями', useDaysContext: assistantRef?.useDaysContext ?? false, useCanvasAsRef: false })">
            <Icon icon="mdi:bank-outline" /> Классика
          </KitBtn>
          <KitBtn variant="outlined" size="sm" @click="handleGlobalGenerate({ prompt: 'Сделай день расслабленным, побольше отдыха и еды', useDaysContext: assistantRef?.useDaysContext ?? false, useCanvasAsRef: false })">
            <Icon icon="mdi:coffee-outline" /> Расслабленный
          </KitBtn>
        </div>
      </div>

      <AddDayActivity
        v-if="!isViewMode && !hasDraftForDay"
        @add="emit('add')"
      />
    </div>

    <div class="undo-snackbar-container">
      <div v-if="undoDayId" class="undo-snackbar">
        <span>Изменения ИИ отклонены</span>
        <button class="undo-btn" @click="handleUndo">
          Отменить
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.day-activities {
  margin-bottom: 32px;

  .draft-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--fg-accent-color);
    gap: 16px;
    font-weight: 500;

    .draft-spinner {
      font-size: 3rem;
    }
  }

  .global-draft-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    margin-bottom: 16px;
    border-radius: var(--r-s);
    background: rgba(var(--fg-accent-color-rgb), 0.06);
    border: 1px dashed var(--fg-accent-color);

    .global-draft-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fg-accent-color);
    }

    .mode-group {
      display: flex;
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-xs);
      padding: 2px;
      gap: 2px;

      &.mr-2 {
        margin-right: 8px;
      }

      :deep(.kit-btn) {
        height: 28px;
        padding: 4px 12px;
        font-size: 0.8rem;
        font-weight: 500;
        border-radius: calc(var(--r-xs) - 2px);
        border: none;
        background: transparent;
        color: var(--fg-secondary-color);
        box-shadow: none;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          color: var(--fg-primary-color);
          transform: none;
          box-shadow: none;
        }

        &.active {
          background: var(--bg-primary-color) !important;
          color: var(--fg-primary-color) !important;
          box-shadow: var(--s-xs);
        }
      }
    }

    .global-draft-actions {
      display: flex;
      gap: 8px;
    }
  }

  .activities-container {
    width: 100%;
    position: relative;
    min-height: 100px;

    .draggable-area {
      min-height: 1px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      border: 2px dashed var(--border-secondary-color);
      border-radius: var(--r-s);
      margin-top: 20px;

      p {
        text-align: center;
        font-size: 0.9rem;
        color: var(--fg-secondary-color);
        margin-bottom: 16px;
      }

      .empty-state-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
      }
    }
  }
}

.ghost-activity {
  opacity: 0.5;
  background: var(--bg-secondary-color);
  border-radius: var(--r-xs);
  > div {
    visibility: hidden;
  }
}

.chosen-activity {
  box-shadow: var(--s-l);
  transform: scale(1.02);
  z-index: 10;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.undo-snackbar-container {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
}

.undo-snackbar {
  background: var(--bg-inverted-color);
  color: var(--fg-inverted-color);
  padding: 12px 20px;
  border-radius: var(--r-s);
  box-shadow: var(--s-l);
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.9rem;
  font-weight: 500;
  pointer-events: auto;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  .undo-btn {
    background: rgba(var(--fg-accent-color-rgb), 0.2);
    color: var(--fg-accent-color);
    border: none;
    padding: 6px 12px;
    border-radius: var(--r-xs);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(var(--fg-accent-color-rgb), 0.3);
    }
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
