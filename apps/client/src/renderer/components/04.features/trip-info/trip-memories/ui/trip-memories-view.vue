<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { EActivityTag, IMemory } from '~/components/05.modules/trip-info/models/types'
import type { Activity } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { Time } from '@internationalized/date'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { ETripMemoriesKeys } from '~/components/04.features/trip-info/trip-memories/store/trip-memories.store'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { getTagInfo, memoryToViewerImage } from '~/components/05.modules/trip-info/lib/helpers'
import { useRequestError } from '~/plugins/request'
import { useDisplay } from '~/shared/composables/use-display'
import { useNotificationStore } from '~/shared/store/notification.store'
import MemoriesList from './memories-list.vue'
import DownloadStatusBanner from './state/download-status-banner.vue'
import MemoriesEmpty from './state/memories-empty.vue'
import MemoriesError from './state/memories-error.vue'
import MemoriesSkeleton from './state/memories-skeleton.vue'

const { mdAndUp } = useDisplay()
const { ui, memories, plan: tripData } = useModuleStore(['ui', 'memories', 'plan'])
const { open: openFileDialog, onChange, reset } = useFileDialog({ accept: '*', multiple: true })
const fetchError = useRequestError(ETripMemoriesKeys.FETCH)
const notificationStore = useNotificationStore()
const confirm = useConfirm()

const {
  memoriesForSelectedDay,
  getProcessingMemories,
  isLoadingMemories,
  downloadProgress,
  isLocalModeEnabled,
  canEnableLocalMode,
  localBlobUrls,
} = storeToRefs(memories)
const { areAllMemoryGroupsCollapsed, isViewMode, activeView } = storeToRefs(ui)
const { getActivitiesForSelectedDay, getSelectedDay } = storeToRefs(tripData)

const dropZoneRef = ref<HTMLDivElement | null>(null)

const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop })

function onDrop(files: File[] | null) {
  if (!files || activeView.value !== 'memories' || isViewMode.value)
    return
  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  if (imageFiles.length > 0)
    memories.enqueueFilesForUpload(imageFiles)
}

onChange((files) => {
  if (!files || files.length === 0)
    return

  memories.enqueueFilesForUpload(Array.from(files))

  reset()
})

const isProcessing = computed(() => getProcessingMemories.value.length > 0)

const memoriesData = computed(() => {
  if (memoriesForSelectedDay.value.length > 0 || isProcessing.value) {
    return memoriesForSelectedDay.value
  }
  return null
})

const timelineGroups = computed(() => {
  const memoriesList = memoriesForSelectedDay.value
  if (memoriesList.length === 0)
    return []

  const groups: any[] = []
  let currentGroup: any = null

  const ensureStartGroup = () => {
    let startGroup = groups.find(g => g.type === 'start')
    if (!startGroup) {
      startGroup = {
        type: 'start',
        title: 'Начало дня',
        memories: [],
        activity: null,
      }
      groups.unshift(startGroup)
    }
    return startGroup
  }

  for (const memory of memoriesList) {
    if (memory.title) {
      currentGroup = {
        type: 'activity',
        activity: memory,
        title: memory.title,
        memories: [],
      }
      if (memory.imageId || memory.comment)
        currentGroup.memories.push(memory)
      groups.push(currentGroup)
    }
    else {
      if (currentGroup) {
        currentGroup.memories.push(memory)
      }
      else {
        const startGroup = ensureStartGroup()
        startGroup.memories.push(memory)
      }
    }
  }
  const startGroup = groups.find(g => g.type === 'start')
  if (startGroup && startGroup.memories.length === 0)
    return groups.filter(g => g.type !== 'start')

  return groups
})

const galleryImages = computed<ImageViewerImage[]>(() => {
  return memoriesForSelectedDay.value
    .map((memory: IMemory) => {
      const img = memoryToViewerImage(memory)
      if (!img)
        return null

      // Если включен локальный режим и есть локальная ссылка для этого изображения
      if (isLocalModeEnabled.value && memory.imageId && localBlobUrls.value.has(memory.imageId)) {
        const localUrl = localBlobUrls.value.get(memory.imageId)!

        // Подменяем основной URL и все варианты на локальный Blob
        // Это гарантирует, что Viewer откроет локальную версию мгновенно
        return {
          ...img,
          url: localUrl,
          variants: {
            small: localUrl,
            medium: localUrl,
            large: localUrl,
            original: localUrl,
          },
        }
      }

      return img
    })
    .filter((img): img is NonNullable<typeof img> => !!img)
})

const allMemoryGroupKeys = computed(() => timelineGroups.value.map(g => g.type + (g.activity?.id || g.title)))
const allMemoryBlocksCollapsed = computed(() => areAllMemoryGroupsCollapsed.value(allMemoryGroupKeys.value))
const collapseMemoriesIcon = computed(() =>
  allMemoryBlocksCollapsed.value ? 'mdi:chevron-double-down' : 'mdi:chevron-double-up',
)

function handleToggleAllMemories() {
  ui.toggleAllMemoryGroups(allMemoryGroupKeys.value)
}

const isFullScreen = ref(false)

function toggleFullScreen() {
  isFullScreen.value = !isFullScreen.value
}

const isAddNoteModalVisible = ref(false)
const newNoteText = ref('')
const isAddActivityModalVisible = ref(false)
const newNoteTime = shallowRef<Time | null>(null)
const newActivity = shallowReactive<{ title: string, time: Time | null, tag: EActivityTag | null }>({
  title: '',
  time: new Time(12, 0),
  tag: null,
})

function handleAddTextNote() {
  newNoteText.value = ''
  newNoteTime.value = new Time(12, 0)
  isAddNoteModalVisible.value = true
}

function saveNewNote() {
  if (!newNoteTime.value || !tripData.currentTripId || !getSelectedDay.value)
    return

  const datePart = getSelectedDay.value.date.split('T')[0]
  const timePart = `${newNoteTime.value.hour.toString().padStart(2, '0')}:${newNoteTime.value.minute.toString().padStart(2, '0')}:00`
  const newTimestamp = `${datePart}T${timePart}.000Z`

  memories.createMemory({
    tripId: tripData.currentTripId,
    comment: newNoteText.value.trim(),
    timestamp: newTimestamp,
  })
  isAddNoteModalVisible.value = false
}

function handleAddActivity() {
  newActivity.title = ''
  newActivity.time = new Time(12, 0)
  newActivity.tag = null
  isAddActivityModalVisible.value = true
}

function saveNewActivity() {
  if (!newActivity.time || !newActivity.title.trim() || !tripData.currentTripId || !getSelectedDay.value)
    return

  const datePart = getSelectedDay.value.date.split('T')[0]
  const timePart = `${newActivity.time.hour.toString().padStart(2, '0')}:${newActivity.time.minute.toString().padStart(2, '0')}:00`
  const newTimestamp = `${datePart}T${timePart}.000Z`

  memories.createMemory({
    tripId: tripData.currentTripId,
    title: newActivity.title.trim(),
    tag: newActivity.tag,
    timestamp: newTimestamp,
  })
  isAddActivityModalVisible.value = false
}

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

const isNotifyLoading = ref(false)

async function handleNotifyParticipants() {
  if (!tripData.currentTripId || !getSelectedDay.value)
    return

  const isConfirmed = await confirm({
    title: 'Уведомить участников?',
    description: 'Все участники путешествия получат Push-уведомление о том, что добавлены новые воспоминания в этот день.',
    confirmText: 'Отправить',
    type: 'default',
  })

  if (!isConfirmed)
    return

  isNotifyLoading.value = true
  try {
    await notificationStore.notifyAboutMemoryUpdate(
      tripData.currentTripId,
      getSelectedDay.value.id,
    )
  }
  finally {
    isNotifyLoading.value = false
  }
}

const localModeTooltip = computed(() => {
  if (!canEnableLocalMode.value)
    return 'Скачайте фото, чтобы включить локальный режим'
  return isLocalModeEnabled.value
    ? 'Локальный режим: фото открываются мгновенно (с диска)'
    : 'Сетевой режим: фото загружаются с сервера'
})
</script>

<template>
  <div
    ref="dropZoneRef"
    class="memories-view"
    :class="{ 'is-fullscreen-mode': isFullScreen }"
  >
    <DownloadStatusBanner :progress="downloadProgress" />

    <div class="divider-with-action">
      <KitDivider
        :is-loading="isLoadingMemories || memories.isCreatingMemory || memories.isMutateMemory"
      >
        воспоминания дня
      </KitDivider>

      <div class="controls-wrapper">
        <button
          v-if="memoriesForSelectedDay.length > 0"
          class="control-btn download-btn"
          :class="{ 'is-active': downloadProgress.isDownloading }"
          :disabled="downloadProgress.isDownloading"
          title="Скачать оригиналы фото в папку"
          @click="memories.downloadAllPhotosToFolder()"
        >
          <Icon icon="mdi:folder-download-outline" />
        </button>

        <button
          v-if="canEnableLocalMode || isLocalModeEnabled"
          class="control-btn local-mode-btn"
          :class="{ 'is-active': isLocalModeEnabled }"
          :title="localModeTooltip"
          :disabled="!canEnableLocalMode"
          @click="memories.toggleLocalMode()"
        >
          <Icon :icon="isLocalModeEnabled ? 'mdi:harddisk' : 'mdi:cloud-outline'" />
        </button>

        <button
          v-if="!isViewMode && memoriesForSelectedDay.length > 0"
          class="control-btn notify-btn"
          :class="{ 'is-loading': isNotifyLoading }"
          :disabled="isNotifyLoading"
          title="Уведомить участников об обновлении"
          @click="handleNotifyParticipants"
        >
          <Icon :icon="isNotifyLoading ? 'mdi:loading' : 'mdi:bell-ring-outline'" :class="{ spin: isNotifyLoading }" />
        </button>

        <button
          v-if="mdAndUp && memoriesForSelectedDay.length > 0"
          class="control-btn fullscreen-btn"
          :title="isFullScreen ? 'Выйти из полноэкранного режима' : 'На весь экран'"
          @click="toggleFullScreen"
        >
          <Icon :icon="isFullScreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
        </button>
        <button
          v-if="allMemoryGroupKeys.length > 0"
          class="control-btn collapse-btn"
          title="Свернуть/развернуть все группы"
          @click="handleToggleAllMemories"
        >
          <Icon :icon="collapseMemoriesIcon" />
        </button>
      </div>
    </div>

    <div class="memories-content-scroll">
      <AsyncStateWrapper
        class="async-wrapper"
        :loading="isLoadingMemories && !isProcessing"
        :error="fetchError"
        :data="memoriesData"
        :retry-handler="() => memories.fetchMemories(tripData.currentTripId!)"
      >
        <template #loading>
          <MemoriesSkeleton />
        </template>

        <template #error="{ error, retry }">
          <MemoriesError :error="error" @retry="retry" />
        </template>

        <template #success>
          <MemoriesList
            :memories="memoriesForSelectedDay"
            :gallery-images="galleryImages"
            :import-options="importOptions"
            :is-view-mode="isViewMode"
            :is-processing="isProcessing"
            :processing-memories="getProcessingMemories"
            :is-full-screen="isFullScreen"
            @upload="() => openFileDialog()"
            @add-note="handleAddTextNote"
            @add-activity="handleAddActivity"
            @import="handleImport"
          />
        </template>

        <template #empty>
          <MemoriesEmpty
            :is-view-mode="isViewMode"
            @upload="() => openFileDialog()"
            @add-note="handleAddTextNote"
            @add-activity="handleAddActivity"
          />
        </template>
      </AsyncStateWrapper>
    </div>

    <div v-if="isOverDropZone && !isViewMode" class="drop-overlay">
      <div class="drop-overlay-content">
        <Icon icon="mdi:upload-multiple" />
        <span>Перетащите файлы сюда для загрузки</span>
      </div>
    </div>

    <KitDialogWithClose
      v-model:visible="isAddNoteModalVisible"
      title="Добавить заметку"
      icon="mdi:note-plus-outline"
      @update:visible="!$event && (isAddNoteModalVisible = false)"
    >
      <div class="add-note-content">
        <textarea v-model="newNoteText" placeholder="Введите текст заметки..." class="note-textarea" />
        <div class="time-picker">
          <label>Время:</label>
          <KitTimeField v-model="newNoteTime" />
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

    <KitDialogWithClose
      v-model:visible="isAddActivityModalVisible"
      title="Добавить активность"
      icon="mdi:plus-box-outline"
      @update:visible="!$event && (isAddActivityModalVisible = false)"
    >
      <div class="add-note-content">
        <KitInput v-model="newActivity.title" placeholder="Название активности..." />
        <div class="time-picker">
          <label>Время:</label>
          <KitTimeField v-model="newActivity.time" />
        </div>
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
.memories-view {
  position: relative;
  min-height: 200px;
  transition: all 0.3s ease;

  &.is-fullscreen-mode {
    position: fixed;
    inset: 0;
    z-index: 15;
    background-color: var(--bg-primary-color);
    padding: 20px 32px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .memories-content-scroll {
      flex: 1;
      overflow-y: auto;
      padding-right: 8px;
      padding-bottom: 40px;

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-thumb {
        background-color: var(--border-secondary-color);
        border-radius: 4px;
      }
    }
  }
}

.divider-with-action {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 16px;

  .kit-divider {
    flex-grow: 1;
  }
}

.controls-wrapper {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 1;
}

.control-btn {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.download-btn {
  &.is-active {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.local-mode-btn {
  &.is-active {
    color: var(--fg-success-color);
    border-color: var(--fg-success-color);
    background-color: rgba(var(--fg-success-color-rgb), 0.1);

    &:hover {
      background-color: rgba(var(--fg-success-color-rgb), 0.2);
    }
  }
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

.drop-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(var(--bg-primary-color-rgb), 0.8);
  backdrop-filter: blur(4px);
  border: 2px dashed var(--fg-accent-color);
  border-radius: var(--r-m);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  &-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--fg-accent-color);
    font-size: 1.2rem;
    font-weight: 600;

    .iconify {
      font-size: 3rem;
    }
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
