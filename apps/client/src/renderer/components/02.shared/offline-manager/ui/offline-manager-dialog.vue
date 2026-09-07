<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { AppRoutePaths } from '~/shared/constants/routes'
import { formatDate } from '~/shared/lib/date-time'
import { useOfflineStore } from '~/shared/store/offline.store'

interface Props {
  visible: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const offlineStore = useOfflineStore()
const router = useRouter()
const confirm = useConfirm()
const moduleStore = useModuleStore(['plan', 'sections'])

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

async function handleUpdate(id: string) {
  if (offlineStore.isTripDownloading(id))
    return

  if (moduleStore.plan.currentTripId === id && moduleStore.plan.trip) {
    await offlineStore.saveTripForOffline({
      ...moduleStore.plan.trip,
      days: moduleStore.plan.days,
      sections: moduleStore.sections.sections,
    })
  }
  else {
    await offlineStore.saveTripByIdForOffline(id)
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
            <h4 class="item-title">
              {{ item.title }}
            </h4>
            <div class="item-meta">
              <span class="date">
                <Icon icon="mdi:clock-outline" class="meta-icon" />
                {{ formatDate(new Date(item.savedAt).toISOString(), { dateStyle: 'short', timeStyle: 'short' }) }}
              </span>
              <span class="files">
                <Icon icon="mdi:image-multiple-outline" class="meta-icon" />
                {{ item.imageCount }} файлов
              </span>
            </div>
            <div v-if="offlineStore.isDownloading[item.id]" class="download-progress">
              <div class="progress-bar" :style="{ width: `${offlineStore.getDownloadProgress(item.id)}%` }" />
            </div>
            <div v-if="offlineStore.isDownloading[item.id] && offlineStore.getDownloadStatus(item.id)?.statusText" class="download-status-text">
              {{ offlineStore.getDownloadStatus(item.id)?.statusText }}
            </div>
          </div>

          <div class="item-actions">
            <KitTooltip text="Обновить данные">
              <button
                class="action-btn update"
                :disabled="offlineStore.isDownloading[item.id]"
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
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
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

.item-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
