<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { EActivityTag, IMemory } from '~/components/05.modules/trip-info/models/types'
import type { Activity } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { Time } from '@internationalized/date'
import { useFileDialog } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { getTagInfo, memoryToViewerImage } from '~/components/05.modules/trip-info/lib/helpers'
import MemoriesMap from './memories-map.vue'
import ProcessingQueue from './processing/processing-queue.vue'
import UploadingIndicator from './processing/uploading-indicator.vue'
import MemoriesTimeline from './timeline/memories-timeline.vue'

const { memories, plan: tripData, ui } = useModuleStore(['memories', 'plan', 'ui'])
const { memoriesForSelectedDay, memoriesToProcess, getProcessingMemories, isLoadingMemories: isLoading, memoriesWithGeo } = storeToRefs(memories)

const { getActivitiesForSelectedDay } = storeToRefs(tripData)
const { isViewMode } = storeToRefs(ui)

const { open: openFileDialog, onChange, reset } = useFileDialog({
  accept: 'image/*',
  multiple: true,
})

const isProcessing = computed(() => getProcessingMemories.value.length > 0)
const isMapVisible = ref(false)

const galleryImages = computed<ImageViewerImage[]>(() => {
  return memoriesForSelectedDay.value
    .map((memory: IMemory) => memoryToViewerImage(memory))
    .filter((img): img is NonNullable<typeof img> => !!img)
})

// --- State for Add Note Modal ---
const isAddNoteModalVisible = ref(false)
const newNoteText = ref('')
const newNoteTime = shallowRef<Time | null>(null)

function handleAddTextNote() {
  newNoteText.value = ''
  newNoteTime.value = new Time(12, 0)
  isAddNoteModalVisible.value = true
}

function saveNewNote() {
  if (!newNoteTime.value)
    return

  const tripId = tripData.currentTripId
  const day = tripData.getSelectedDay
  if (!tripId || !day || !newNoteText.value.trim())
    return

  const datePart = day.date.split('T')[0]
  const timePart = `${newNoteTime.value.hour.toString().padStart(2, '0')}:${newNoteTime.value.minute.toString().padStart(2, '0')}:00`
  const newTimestamp = `${datePart}T${timePart}.000Z`

  memories.createMemory({
    tripId,
    comment: newNoteText.value.trim(),
    timestamp: newTimestamp,
  })
  isAddNoteModalVisible.value = false
}

// --- State for Add Activity Modal ---
const isAddActivityModalVisible = ref(false)
const newActivity = shallowReactive<{ title: string, time: Time | null, tag: EActivityTag | null }>({
  title: '',
  time: new Time(12, 0),
  tag: null,
})

function handleAddActivity() {
  newActivity.title = ''
  newActivity.time = new Time(12, 0)
  newActivity.tag = null
  isAddActivityModalVisible.value = true
}

function saveNewActivity() {
  if (!newActivity.time || !newActivity.title.trim())
    return

  const tripId = tripData.currentTripId
  const day = tripData.getSelectedDay
  if (!tripId || !day)
    return

  const datePart = day.date.split('T')[0]
  const timePart = `${newActivity.time.hour.toString().padStart(2, '0')}:${newActivity.time.minute.toString().padStart(2, '0')}:00`
  const newTimestamp = `${datePart}T${timePart}.000Z`

  memories.createMemory({
    tripId,
    title: newActivity.title.trim(),
    tag: newActivity.tag,
    timestamp: newTimestamp,
  })
  isAddActivityModalVisible.value = false
}

// --- Logic for Import from Plan ---
const importOptions = computed(() => {
  const existingSourceIds = new Set(memories.memories.map(m => m.sourceActivityId).filter(Boolean))
  return getActivitiesForSelectedDay.value
    .filter(act => !existingSourceIds.has(act.id))
    .map(activity => ({
      value: activity,
      label: `${activity.startTime} - ${activity.title}`,
      icon: getTagInfo(activity.tag)?.icon,
    }))
})

function handleImport(activity: Activity) {
  if (activity)
    memories.importActivityFromPlan(activity)
}

onChange((files) => {
  if (!files || files.length === 0)
    return

  memories.enqueueFilesForUpload(Array.from(files))
  reset()
})
</script>

<template>
  <div class="memories-list">
    <div v-if="!isViewMode" class="upload-section">
      <button class="upload-button" :disabled="isProcessing" @click="() => openFileDialog()">
        <Icon :icon="isProcessing ? 'mdi:loading' : 'mdi:camera-plus-outline'" :class="{ spin: isProcessing }" />
        <span>{{ isProcessing ? `Загрузка (${getProcessingMemories.length})...` : 'Загрузить фотографии' }}</span>
      </button>
      <button class="add-note-button" @click="handleAddActivity">
        <Icon icon="mdi:plus-box-outline" />
        <span>Добавить активность</span>
      </button>
      <button class="add-note-button" @click="handleAddTextNote">
        <Icon icon="mdi:note-plus-outline" />
        <span>Добавить заметку</span>
      </button>
      <KitDropdown :items="importOptions" align="end" @update:model-value="handleImport">
        <template #trigger>
          <button class="add-note-button" :disabled="importOptions.length === 0">
            <Icon icon="mdi:import" />
            <span>Импорт из плана</span>
          </button>
        </template>
      </KitDropdown>
    </div>

    <UploadingIndicator
      v-if="isProcessing"
      :processing-memories="getProcessingMemories"
      @cancel="memories.cancelMemoryUpload"
      @retry="memories.retryMemoryUpload"
      @remove="memories.removeProcessingMemory"
    />

    <ProcessingQueue v-if="!isViewMode && memoriesToProcess.length > 0" />

    <MemoriesMap
      v-if="isMapVisible"
      :memories="memoriesWithGeo"
      @close="isMapVisible = false"
    />

    <MemoriesTimeline
      v-if="memoriesForSelectedDay.length > 0"
      :memories="memoriesForSelectedDay"
      :is-view-mode="isViewMode"
      :gallery-images="galleryImages"
    />

    <div v-if="isLoading" class="state-info">
      Загрузка воспоминаний...
    </div>
    <div
      v-else-if="memoriesForSelectedDay.length === 0 && memoriesToProcess.length === 0 && !isProcessing"
      class="empty-state"
    >
      <p>В этом дне пока нет воспоминаний.</p>
      <p v-if="!isViewMode">
        Добавьте свои первые фотографии или заметки, чтобы создать ленту этого дня!
      </p>
    </div>

    <div v-if="memoriesWithGeo.length > 0 && !isMapVisible" class="map-button-container">
      <KitBtn
        variant="outlined"
        color="secondary"
        @click="isMapVisible = true"
      >
        <Icon icon="mdi:map-marker-outline" />
        Показать фотографии на карте
      </KitBtn>
    </div>

    <!-- Add Note Modal -->
    <KitDialogWithClose
      v-model:visible="isAddNoteModalVisible"
      title="Добавить заметку"
      icon="mdi:note-plus-outline"
      @update:visible="!$event && (isAddNoteModalVisible = false)"
    >
      <div class="add-note-content">
        <textarea v-model="newNoteText" placeholder="Введите текст заметки..." class="note-textarea" />
        <div class="time-picker">
          <label for="note-time">Время:</label>
          <KitTimeField
            id="note-time"
            v-model="newNoteTime"
          />
        </div>
      </div>
      <div class="add-note-footer">
        <KitBtn variant="text" @click="isAddNoteModalVisible = false">
          Отмена
        </KitBtn>
        <KitBtn :disabled="!newNoteText.trim()" @click="saveNewNote">
          Сохранить
        </KitBtn>
      </div>
    </KitDialogWithClose>

    <!-- Add Activity Modal -->
    <KitDialogWithClose
      v-model:visible="isAddActivityModalVisible"
      title="Добавить активность"
      icon="mdi:plus-box-outline"
      @update:visible="!$event && (isAddActivityModalVisible = false)"
    >
      <div class="add-note-content">
        <KitInput v-model="newActivity.title" placeholder="Название активности..." />
        <div class="time-picker">
          <label for="activity-time">Время:</label>
          <KitTimeField id="activity-time" v-model="newActivity.time" />
        </div>
        <!-- TODO: Add tag selector here if needed -->
      </div>
      <div class="add-note-footer">
        <KitBtn variant="text" @click="isAddActivityModalVisible = false">
          Отмена
        </KitBtn>
        <KitBtn :disabled="!newActivity.title.trim()" @click="saveNewActivity">
          Сохранить
        </KitBtn>
      </div>
    </KitDialogWithClose>
  </div>
</template>

<style scoped lang="scss">
.memories-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-bottom: 16px;
}

.upload-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 24px;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);
  margin-top: 16px;

  @include media-up(sm) {
    grid-template-columns: repeat(2, 1fr);
  }
  @include media-up(md) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.upload-button,
.add-note-button {
  flex: 1;
  padding: 16px;
  border-radius: var(--r-s);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.upload-button {
  background-color: transparent;
  border: 2px dashed var(--border-primary-color);
  color: var(--fg-accent-color);
  grid-column: 1 / -1;

  @include media-up(sm) {
    grid-column: auto;
  }

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }
  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
}

.add-note-button {
  background-color: var(--bg-tertiary-color);
  border: 2px solid var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.state-info {
  text-align: center;
  padding: 48px 24px;
  color: var(--fg-secondary-color);
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-l);

  p {
    margin: 0;
    line-height: 1.6;

    &:first-child {
      font-weight: 500;
      font-size: 1.1rem;
      color: var(--fg-primary-color);
    }
  }
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
  }
}

.map-button-container {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-secondary-color);
}

.spin {
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

.add-note-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}
.note-textarea {
  width: 100%;
  min-height: 120px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  padding: 8px;
  font-family: inherit;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: var(--fg-accent-color);
  }
}
.time-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-secondary-color);
}
.add-note-footer {
  padding-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
