<script setup lang="ts">
import type { Time } from '@internationalized/date'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { Activity } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { ETripMemoriesKeys } from '~/components/04.features/trip-info/trip-memories/store/trip-memories.store'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { getTagInfo } from '~/components/05.modules/trip-info/lib/helpers'
import { useRequestError } from '~/plugins/request'
import { useDisplay } from '~/shared/composables/use-display'
import { useNotificationStore } from '~/shared/store/notification.store'
import { useTripMemoriesVault } from '../composables/use-trip-memories-vault'
import { resolveMemoryImageSource } from '../lib/resolve-memory-image'
import AddActivityDialog from './dialogs/add-activity-dialog.vue'
import AddNoteDialog from './dialogs/add-note-dialog.vue'
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
  vaultStore,
  handleDownloadVault,
  handleToggleLocalMode,
  isElectron,
  syncState,
} = useTripMemoriesVault()

const {
  memoriesForSelectedDay,
  getProcessingMemories,
  isLoadingMemories,
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
  if (memoriesForSelectedDay.value.length > 0 || isProcessing.value)
    return memoriesForSelectedDay.value
  return null
})

const { timelineGroupsForSelectedDay: timelineGroups } = storeToRefs(memories)

const galleryImages = computed<ImageViewerImage[]>(() => {
  const currentDayId = getSelectedDay.value?.id

  return memoriesForSelectedDay.value
    .filter(memory => memory.image)
    .map((memory) => {
      const image = memory.image!
      const { url, variants } = resolveMemoryImageSource(
        image,
        vaultStore,
        tripData.currentTripId,
        currentDayId,
      )
      const meta = {
        ...image.metadata,
        latitude: image.latitude,
        longitude: image.longitude,
        takenAt: image.takenAt,
        width: image.width,
        height: image.height,
        imageId: image.id,
        memoryId: memory.id,
      }
      return {
        url,
        variants,
        alt: memory.comment || 'Trip Image',
        caption: memory.comment ?? null,
        meta,
      }
    })
})

const allMemoryGroupKeys = computed(() =>
  timelineGroups.value.map(g => g.type + (g.activity?.id || g.title)),
)
const allMemoryBlocksCollapsed = computed(() =>
  areAllMemoryGroupsCollapsed.value(allMemoryGroupKeys.value),
)
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

const isAddNoteDialogVisible = ref(false)
const isAddActivityDialogVisible = ref(false)

function handleAddTextNote() {
  isAddNoteDialogVisible.value = true
}

function handleAddActivity() {
  isAddActivityDialogVisible.value = true
}

function handleSaveNote(text: string, time: Time) {
  if (!tripData.currentTripId || !getSelectedDay.value)
    return
  const datePart = getSelectedDay.value.date.split('T')[0]
  const h = time.hour.toString().padStart(2, '0')
  const m = time.minute.toString().padStart(2, '0')
  memories.createMemory({
    tripId: tripData.currentTripId,
    comment: text,
    timestamp: `${datePart}T${h}:${m}:00.000Z`,
  })
}

function handleSaveActivity(title: string, time: Time) {
  if (!tripData.currentTripId || !getSelectedDay.value)
    return
  const datePart = getSelectedDay.value.date.split('T')[0]
  const h = time.hour.toString().padStart(2, '0')
  const m = time.minute.toString().padStart(2, '0')
  memories.createMemory({
    tripId: tripData.currentTripId,
    title,
    timestamp: `${datePart}T${h}:${m}:00.000Z`,
  })
}

const importOptions = computed(() => {
  const existingSourceIds = new Set(
    memories.memories.map((m: any) => m.sourceActivityId).filter(Boolean),
  )
  return getActivitiesForSelectedDay.value
    .filter((act: any) => !existingSourceIds.has(act.id))
    .map((activity: any) => ({
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
    description: 'Push-уведомления будут отправлены всем участникам поездки.',
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
</script>

<template>
  <div ref="dropZoneRef" class="memories-view" :class="{ 'is-fullscreen-mode': isFullScreen }">
    <DownloadStatusBanner :progress="syncState" />

    <div class="divider-with-action">
      <KitDivider
        :is-loading="isLoadingMemories || memories.isCreatingMemory || memories.isMutateMemory"
      />
      <div class="controls-wrapper">
        <template v-if="isElectron">
          <button
            class="control-btn local-mode-btn"
            :class="{ 'is-active': vaultStore.isLocalMode && vaultStore.isConfigured }"
            :title="vaultStore.isLocalMode ? 'Локальный режим включён' : 'Включить локальный режим'"
            @click="handleToggleLocalMode"
          >
            <Icon :icon="vaultStore.isLocalMode ? 'mdi:harddisk' : 'mdi:cloud-outline'" />
          </button>

          <button
            v-if="memoriesForSelectedDay.length > 0 && vaultStore.isLocalMode"
            class="control-btn sync-btn"
            :class="{ 'is-active': syncState.isDownloading }"
            :disabled="syncState.isDownloading"
            :title="syncState.isDownloading ? 'Скачивание...' : 'Скачать фото локально'"
            @click="handleDownloadVault"
          >
            <Icon
              :icon="syncState.isDownloading ? 'mdi:loading' : 'mdi:download-network-outline'"
              :class="{ spin: syncState.isDownloading }"
            />
          </button>
        </template>

        <button
          v-if="!isViewMode && memoriesForSelectedDay.length > 0"
          class="control-btn notify-btn"
          :class="{ 'is-loading': isNotifyLoading }"
          :disabled="isNotifyLoading"
          title="Уведомить участников"
          @click="handleNotifyParticipants"
        >
          <Icon
            :icon="isNotifyLoading ? 'mdi:loading' : 'mdi:bell-ring-outline'"
            :class="{ spin: isNotifyLoading }"
          />
        </button>

        <button
          v-if="mdAndUp && memoriesForSelectedDay.length > 0"
          class="control-btn fullscreen-btn"
          :title="isFullScreen ? 'Свернуть' : 'На весь экран'"
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
          <MemoriesError :error="error" :retry="retry" />
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
            @upload="openFileDialog"
            @add-note="handleAddTextNote"
            @add-activity="handleAddActivity"
            @import="handleImport"
          />
        </template>

        <template #empty>
          <MemoriesEmpty
            :is-view-mode="isViewMode"
            :import-options="importOptions"
            @upload="openFileDialog"
            @add-note="handleAddTextNote"
            @add-activity="handleAddActivity"
            @import="handleImport"
          />
        </template>
      </AsyncStateWrapper>

      <div v-if="isOverDropZone && !isViewMode" class="drop-overlay">
        <div class="drop-overlay-content">
          <Icon icon="mdi:upload-multiple" />
          <span>Отпустите, чтобы загрузить</span>
        </div>
      </div>
    </div>

    <AddNoteDialog
      v-model:visible="isAddNoteDialogVisible"
      @save="handleSaveNote"
    />

    <AddActivityDialog
      v-model:visible="isAddActivityDialogVisible"
      @save="handleSaveActivity"
    />
  </div>
</template>

<style scoped lang="scss">
.memories-view {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  position: relative;

  &.is-fullscreen-mode {
    position: fixed;
    inset: 0;
    z-index: 100;
    background-color: var(--bg-primary-color);
    overflow-y: auto;
    padding: 24px;
  }
}

.divider-with-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.controls-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  background: transparent;
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.is-active {
    background-color: color-mix(in srgb, var(--fg-accent-color) 15%, transparent);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.memories-content-scroll {
  flex-grow: 1;
  overflow-y: auto;
  padding-bottom: 32px;
  position: relative;
}

.async-wrapper {
  height: 100%;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  background-color: color-mix(in srgb, var(--fg-accent-color) 10%, transparent);
  border: 2px dashed var(--fg-accent-color);
  border-radius: var(--r-l);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.drop-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--fg-accent-color);
  font-size: 1.1rem;
  font-weight: 600;

  .iconify {
    font-size: 3rem;
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
</style>
