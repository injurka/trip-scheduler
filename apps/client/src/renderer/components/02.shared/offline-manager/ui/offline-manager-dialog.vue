<script setup lang="ts">
import type { OfflineDownloadOptions, OfflineTripEntry } from '~/shared/store/offline.store'
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useConnectivity } from '~/shared/lib/connectivity'
import { formatDate } from '~/shared/lib/date-time'
import { calculateTripBoundingBox } from '~/shared/lib/tile-calc'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { useOfflineStore } from '~/shared/store/offline.store'
import OfflineDownloadDialog from './offline-download-dialog.vue'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const offlineStore = useOfflineStore()
const router = useRouter()
const confirm = useConfirm()
const moduleStore = useModuleStore(['plan', 'sections'])
const { isOnline } = useConnectivity()

const selectedTripForUpdate = ref<{ id: string, title: string, hasCoordinates: boolean } | null>(null)
const isDownloadDialogOpen = ref(false)
const storageEstimate = ref<{ usage: number, quota: number } | null>(null)
const remoteUpdatedAtMap = ref<Record<string, number>>({})

const selectedSavedEntry = computed(() => selectedTripForUpdate.value ? offlineStore.savedTrips[selectedTripForUpdate.value.id] : undefined)
const storageUsagePercent = computed(() => {
  if (!storageEstimate.value || !storageEstimate.value.quota)
    return 0

  return Math.min(100, Math.round((storageEstimate.value.usage / storageEstimate.value.quota) * 100))
})

watch(() => props.visible, (visible) => {
  if (visible) {
    void refreshStorageEstimate()
    void checkRemoteTripUpdates()
  }
}, { immediate: true })
watch(() => offlineStore.sortedSavedTrips.length, () => {
  if (props.visible)
    void refreshStorageEstimate()
})

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0)
    return '0 Б'

  if (bytes < 1024)
    return `${bytes} Б`

  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} КБ`

  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`
}
async function refreshStorageEstimate() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate)
    return

  try {
    const estimate = await navigator.storage.estimate()

    if (typeof estimate.usage === 'number' && typeof estimate.quota === 'number') {
      storageEstimate.value = {
        usage: estimate.usage,
        quota: estimate.quota,
      }
    }
  }
  catch {
    // Оценка хранилища может быть недоступна в отдельных браузерах
  }
}
async function checkRemoteTripUpdates() {
  if (!isOnline.value || !trpc.trip?.getById?.query)
    return

  for (const entry of offlineStore.sortedSavedTrips) {
    try {
      const remoteTrip = await trpc.trip.getById.query({ tripId: entry.id })

      if (remoteTrip?.updatedAt) {
        const ts = new Date(remoteTrip.updatedAt).getTime()

        if (Number.isFinite(ts))
          remoteUpdatedAtMap.value[entry.id] = ts
      }
    }
    catch {
      // Игнорируем сетевые ошибки проверки свежести
    }
  }
}
function toTimestamp(value: unknown): number {
  if (typeof value === 'number')
    return value

  if (typeof value === 'string' || value instanceof Date) {
    const parsed = new Date(value).getTime()

    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}
function hasUpdateAvailable(entry: OfflineTripEntry): boolean {
  const candidates: number[] = [
    toTimestamp(entry.data?.updatedAt),
    remoteUpdatedAtMap.value[entry.id] ?? 0,
  ]

  entry.data?.days?.forEach(day => candidates.push(toTimestamp((day as { updatedAt?: string }).updatedAt)))
  entry.data?.sections?.forEach(sec => candidates.push(toTimestamp(sec.updatedAt)))

  if (moduleStore.plan.currentTripId === entry.id && moduleStore.plan.trip) {
    candidates.push(toTimestamp(moduleStore.plan.trip.updatedAt))
    moduleStore.plan.days.forEach(day => candidates.push(toTimestamp((day as { updatedAt?: string }).updatedAt)))
    moduleStore.sections.sections.forEach(sec => candidates.push(toTimestamp(sec.updatedAt)))
  }

  return candidates.some(ts => ts > entry.savedAt)
}
function goToTrip(id: string) {
  emit('update:visible', false)
  router.push(AppRoutePaths.Trip.Info(id))
}
async function handleDelete(id: string, title: string) {
  const isConfirmed = await confirm({
    title: 'Удалить из памяти устройства?',
    description: `Офлайн-копия путешествия "${title}" будет удалена. Без интернета доступ к нему будет ограничен.`,
    type: 'danger',
    confirmText: 'Удалить',
  })

  if (isConfirmed) {
    await offlineStore.removeOfflineTrip(id)
  }
}
function handleUpdate(id: string) {
  if (offlineStore.isTripDownloading(id)) {
    offlineStore.openProgressDialog(id)

    return
  }

  const currentSaved = offlineStore.savedTrips[id]
  const hasCoordinates = currentSaved?.data
    ? Boolean(calculateTripBoundingBox(currentSaved.data))
    : (currentSaved?.includesTiles ?? true)

  selectedTripForUpdate.value = {
    id,
    title: currentSaved?.title || 'Путешествие',
    hasCoordinates,
  }
  isDownloadDialogOpen.value = true
}
async function handleConfirmDownload(options: OfflineDownloadOptions) {
  if (!selectedTripForUpdate.value)
    return

  const id = selectedTripForUpdate.value.id

  if (moduleStore.plan.currentTripId === id && moduleStore.plan.trip) {
    await offlineStore.saveTripForOffline({
      ...moduleStore.plan.trip,
      days: moduleStore.plan.days,
      sections: moduleStore.sections.sections,
    }, options)
  }
  else {
    await offlineStore.saveTripByIdForOffline(id, options)
  }
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Оффлайн доступ"
    icon="mdi:cloud-check"
    :max-width="600"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="offline-manager">
      <div class="manager-description">
        <Icon icon="mdi:information-outline" class="desc-icon" />
        <p>Сохраненные путешествия доступны для просмотра и навигации без интернета. Карты, фото, заметки и документы работают автономно.</p>
      </div>

      <div v-if="storageEstimate" class="storage-estimate">
        <div class="storage-estimate-header">
          <span class="storage-estimate-label">
            <Icon icon="mdi:harddisk" class="meta-icon" />
            Хранилище устройства
          </span>
          <span class="storage-estimate-value">
            {{ formatBytes(storageEstimate.usage) }} из {{ formatBytes(storageEstimate.quota) }} ({{ storageUsagePercent }}%)
          </span>
        </div>
        <div class="storage-estimate-bar">
          <div class="storage-estimate-fill" :style="{ width: `${storageUsagePercent}%` }" />
        </div>
      </div>

      <div v-if="offlineStore.sortedSavedTrips.length === 0" class="empty-state">
        <Icon icon="mdi:cloud-off-outline" class="empty-icon" />
        <p class="empty-title">
          У вас нет сохраненных путешествий
        </p>
        <span class="empty-subtitle">Откройте нужное путешествие, нажмите меню действий (три точки) в шапке и выберите «Сохранить оффлайн».</span>
      </div>

      <div v-else class="trips-list">
        <div v-for="item in offlineStore.sortedSavedTrips" :key="item.id" class="offline-item">
          <div class="item-icon-wrapper" @click="goToTrip(item.id)">
            <Icon icon="mdi:map-check-outline" />
          </div>

          <div class="item-info" @click="goToTrip(item.id)">
            <div class="item-title-row">
              <h4 class="item-title">
                {{ item.title }}
              </h4>
              <span v-if="hasUpdateAvailable(item)" class="update-badge">
                Доступно обновление
              </span>
            </div>
            <div class="item-meta">
              <span class="date">
                <Icon icon="mdi:clock-outline" class="meta-icon" />
                {{ formatDate(new Date(item.savedAt).toISOString(), { dateStyle: 'short', timeStyle: 'short' }) }}
              </span>
              <span class="files">
                <Icon icon="mdi:image-multiple-outline" class="meta-icon" />
                {{ item.imageCount }} файлов
              </span>
              <span v-if="typeof item.sizeBytes === 'number'" class="size">
                <Icon icon="mdi:database-outline" class="meta-icon" />
                {{ formatBytes(item.sizeBytes) }}
              </span>
            </div>
            <p v-if="item.mapCoverage?.length" class="item-meta">
              Сохранено участков карты: {{ item.mapCoverage.length }}. Можно докачать другие области.
            </p>
            <p v-if="item.mapPending && !offlineStore.isDownloading[item.id]" class="item-warning">
              Карта сохранена частично. Откройте обновление копии, чтобы докачать выбранные области.
            </p>
            <p v-if="!item.cacheName || item.unavailableCount" class="item-warning">
              {{ !item.cacheName ? 'Обновите копию для восстановления оффлайн-файлов.' : `Сохранено не полностью: недоступно ${item.unavailableCount} элементов. Повторите загрузку.` }}
            </p>
            <div
              v-if="offlineStore.isDownloading[item.id]"
              class="download-progress"
              role="button"
              tabindex="0"
              title="Нажмите, чтобы открыть статус загрузки"
              @click.stop="offlineStore.openProgressDialog(item.id)"
              @keydown.enter.stop="offlineStore.openProgressDialog(item.id)"
            >
              <div class="progress-bar" :style="{ width: `${offlineStore.getDownloadProgress(item.id)}%` }" />
            </div>
            <div
              v-if="offlineStore.isDownloading[item.id] && offlineStore.getDownloadStatus(item.id)?.statusText"
              class="download-status-text"
              role="button"
              tabindex="0"
              title="Нажмите, чтобы открыть статус загрузки"
              @click.stop="offlineStore.openProgressDialog(item.id)"
              @keydown.enter.stop="offlineStore.openProgressDialog(item.id)"
            >
              {{ offlineStore.getDownloadStatus(item.id)?.statusText }}
            </div>
          </div>

          <div class="item-actions">
            <KitTooltip :text="offlineStore.isDownloading[item.id] ? 'Загрузка... Открыть статус' : 'Обновить данные'">
              <button
                class="action-btn update"
                @click="handleUpdate(item.id)"
              >
                <Icon icon="mdi:refresh" :class="{ spin: offlineStore.isDownloading[item.id] }" />
              </button>
            </KitTooltip>
            <KitTooltip text="Удалить из памяти">
              <button
                class="action-btn delete"
                :disabled="offlineStore.isDownloading[item.id]"
                @click="handleDelete(item.id, item.title)"
              >
                <Icon icon="mdi:trash-can-outline" />
              </button>
            </KitTooltip>
          </div>
        </div>
      </div>
    </div>

    <OfflineDownloadDialog
      v-model:visible="isDownloadDialogOpen"
      :trip-title="selectedTripForUpdate?.title"
      :has-coordinates="selectedTripForUpdate?.hasCoordinates"
      :trip="selectedSavedEntry?.data"
      :initial-map-options="selectedSavedEntry?.mapOptions"
      :saved-map-coverage="selectedSavedEntry?.mapCoverage"
      @confirm="handleConfirmDownload"
    />
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.item-warning {
  color: var(--color-warning, #b36b00);
  font-size: 0.8rem;
}
.offline-manager {
  display: flex;
  flex-direction: column;
  min-height: 200px;
  gap: 16px;
}

.manager-description {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.88rem;
  color: var(--fg-secondary-color);
  background-color: var(--bg-tertiary-color);
  padding: 12px;
  border-radius: var(--r-s);

  .desc-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
    margin-top: 1px;
    color: var(--fg-accent-color);
  }

  p {
    margin: 0;
    line-height: 1.4;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--fg-secondary-color);
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0 0 6px;
  }

  .empty-subtitle {
    font-size: 0.85rem;
    line-height: 1.4;
    max-width: 400px;
  }
}

.trips-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.offline-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
  }
}

.item-icon-wrapper {
  width: 40px;
  height: 40px;
  background-color: var(--bg-tertiary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);
  font-size: 1.2rem;
  flex-shrink: 0;
  cursor: pointer;
}

.item-info {
  flex-grow: 1;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.item-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: var(--r-full, 999px);
  background-color: color-mix(in srgb, var(--fg-accent-color) 15%, transparent);
  color: var(--fg-accent-color);
  flex-shrink: 0;
}

.storage-estimate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);

  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
  }

  &-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    color: var(--fg-primary-color);
  }

  &-bar {
    height: 6px;
    width: 100%;
    background-color: var(--bg-tertiary-color);
    border-radius: 3px;
    overflow: hidden;
  }

  &-fill {
    height: 100%;
    background-color: var(--fg-accent-color);
    transition: width 0.3s ease;
  }
}

.item-meta {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  display: flex;
  gap: 12px;
  align-items: center;

  span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .meta-icon {
    font-size: 14px;
  }
}

.item-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    color: var(--fg-primary-color);
    background-color: var(--bg-tertiary-color);
  }

  &.delete:not(:disabled):hover {
    color: var(--fg-error-color);
    border-color: var(--fg-error-color);
    background-color: var(--bg-error-color-dim);
  }
}

.download-progress {
  height: 4px;
  width: 100%;
  background-color: var(--bg-tertiary-color);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
  cursor: pointer;

  .progress-bar {
    height: 100%;
    background-color: var(--fg-success-color);
    transition: width 0.3s ease;
  }
}

.download-status-text {
  font-size: 0.75rem;
  color: var(--fg-accent-color);
  margin-top: 2px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
