<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
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
// Для обновления текущего открытого путешествия, если мы в нем
const moduleStore = useModuleStore(['plan'])

function goToTrip(id: string) {
  emit('update:visible', false)
  router.push(AppRoutePaths.Trip.Info(id))
}

function handleDelete(id: string) {
  offlineStore.removeOfflineTrip(id)
}

async function handleUpdate(id: string) {
  // Чтобы обновить, нам нужно сначала скачать свежие данные с сервера.
  // Если мы уже на странице этого путешествия, берем данные из стора
  if (moduleStore.plan.currentTripId === id && moduleStore.plan.trip) {
    await offlineStore.saveTripForOffline({
      ...moduleStore.plan.trip,
      days: moduleStore.plan.days,
      // @ts-expect-error sections access
      sections: moduleStore.sections.sections,
    })
  }
  else {
    // Если мы не в этом путешествии, сложнее.
    // В идеале нужно сделать fetchTripDetails(id) во временную переменную.
    // Покажем тост, что нужно открыть путешествие.
    const toast = useToast()
    toast.info('Откройте путешествие, чтобы обновить его кэш.')
    goToTrip(id)
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
        <p>Сохраненные путешествия доступны для просмотра без интернета. Карты и изображения также будут работать.</p>
      </div>

      <div v-if="offlineStore.sortedSavedTrips.length === 0" class="empty-state">
        <Icon icon="mdi:cloud-off-outline" class="empty-icon" />
        <p>У вас нет сохраненных путешествий.</p>
        <span>Откройте любое путешествие, нажмите меню "Еще" (три точки) и выберите "Сохранить оффлайн".</span>
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
            <!-- Прогресс бар если идет загрузка -->
            <div v-if="offlineStore.isDownloading[item.id]" class="download-progress">
              <div class="progress-bar" :style="{ width: `${offlineStore.downloadProgress[item.id]}%` }" />
            </div>
          </div>

          <div class="item-actions">
            <button class="action-btn update" title="Обновить данные" @click="handleUpdate(item.id)">
              <Icon icon="mdi:refresh" :class="{ spin: offlineStore.isDownloading[item.id] }" />
            </button>
            <button class="action-btn delete" title="Удалить из памяти" @click="handleDelete(item.id)">
              <Icon icon="mdi:trash-can-outline" />
            </button>
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
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  background-color: var(--bg-tertiary-color);
  padding: 12px;
  border-radius: var(--r-s);
  p {
    margin: 0;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--fg-secondary-color);
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
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
}

.item-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
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

  &:hover {
    color: var(--fg-primary-color);
    background-color: var(--bg-tertiary-color);
  }

  &.delete:hover {
    color: var(--fg-error-color);
    border-color: var(--fg-error-color);
    background-color: var(--bg-error-color-dim);
  }
}

.download-progress {
  height: 3px;
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

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
