<script setup lang="ts">
import type { MapMarker } from '~/components/01.kit/kit-map'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap } from '~/components/01.kit/kit-map'
import { useToast } from '~/shared/composables/use-toast'

// Состояние
const markers = ref<MapMarker[]>([])
const isDialogOpen = ref(false)
const toast = useToast()

// Форма
const form = ref({
  title: '',
  description: '',
  duration: '',
  coords: null as [number, number] | null,
})

// Обработка клика по карте
function handleMapClick(coords: [number, number]) {
  form.value.coords = coords
  form.value.title = ''
  form.value.description = ''
  form.value.duration = ''
  isDialogOpen.value = true
}

// Сохранение активности
function saveActivity() {
  if (!form.value.title || !form.value.coords) {
    toast.error('Укажите название активности')
    return
  }

  const newMarker: MapMarker = {
    id: crypto.randomUUID(),
    coords: {
      lon: form.value.coords[0],
      lat: form.value.coords[1],
    },
    // Можно использовать иконку или изображение, если есть
    payload: {
      title: form.value.title,
      description: form.value.description,
      duration: form.value.duration,
    },
  }

  markers.value.push(newMarker)
  isDialogOpen.value = false
  toast.success('Активность добавлена на карту')
}

// Удаление маркера (опционально, если нужно)
function removeMarker(id: string) {
  markers.value = markers.value.filter(m => m.id !== id)
}
</script>

<template>
  <div class="activity-map-container">
    <div class="map-header">
      <h2>Карта активностей</h2>
      <p>Кликните на карту, чтобы отметить, чем вы планируете заняться.</p>
    </div>

    <div class="map-wrapper">
      <KitMap
        :center="[37.6176, 55.7558]"
        :zoom="12"
        height="100%"
        width="100%"
        :markers="markers"
        @click="handleMapClick"
      />

      <!-- Список активностей справа (или снизу на мобильных) -->
      <div v-if="markers.length > 0" class="activities-sidebar">
        <h3>Ваши планы</h3>
        <div class="activities-list">
          <div v-for="marker in markers" :key="marker.id" class="activity-card">
            <div class="card-header">
              <span class="activity-title">{{ marker.payload.title }}</span>
              <button class="delete-btn" @click="removeMarker(marker.id)">
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div v-if="marker.payload.duration" class="activity-meta">
              <Icon icon="mdi:clock-outline" />
              <span>{{ marker.payload.duration }}</span>
            </div>
            <p v-if="marker.payload.description" class="activity-desc">
              {{ marker.payload.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Диалог добавления -->
    <KitDialogWithClose
      v-model:visible="isDialogOpen"
      title="Новая активность"
      icon="mdi:map-marker-plus"
      :max-width="400"
    >
      <div class="form-content">
        <KitInput
          v-model="form.title"
          label="Что будем делать?"
          placeholder="Например: Отдых в парке"
          required
        />

        <KitInput
          v-model="form.duration"
          label="Длительность"
          placeholder="Например: 2 часа"
          icon="mdi:clock-time-four-outline"
        />

        <KitInput
          v-model="form.description"
          type="textarea"
          label="Комментарий"
          placeholder="Подробности..."
        />

        <div class="form-actions">
          <KitBtn variant="text" @click="isDialogOpen = false">
            Отмена
          </KitBtn>
          <KitBtn @click="saveActivity">
            Добавить метку
          </KitBtn>
        </div>
      </div>
    </KitDialogWithClose>
  </div>
</template>

<style scoped lang="scss">
.activity-map-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

.map-header {
  h2 {
    margin: 0 0 4px 0;
    color: var(--fg-primary-color);
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 0.9rem;
  }
}

.map-wrapper {
  flex-grow: 1;
  position: relative;
  display: flex;
  gap: 16px;
  overflow: hidden;
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);

  :deep(.kit-map-wrapper) {
    flex-grow: 1;
    height: 100% !important;
  }
}

.activities-sidebar {
  width: 300px;
  background-color: var(--bg-secondary-color);
  border-left: 1px solid var(--border-secondary-color);
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;

  h3 {
    margin: 0 0 16px 0;
    font-size: 1.1rem;
    color: var(--fg-primary-color);
  }
}

.activities-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-card {
  background-color: var(--bg-tertiary-color);
  padding: 12px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    transform: translateY(-2px);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.activity-title {
  font-weight: 600;
  color: var(--fg-primary-color);
}

.delete-btn {
  color: var(--fg-tertiary-color);
  transition: color 0.2s;
  cursor: pointer;
  &:hover {
    color: var(--fg-error-color);
  }
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--fg-accent-color);
  margin-bottom: 4px;
}

.activity-desc {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  margin: 0;
  line-height: 1.4;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

@include media-down(md) {
  .map-wrapper {
    flex-direction: column;
  }
  .activities-sidebar {
    width: 100%;
    height: 250px;
    border-left: none;
    border-top: 1px solid var(--border-secondary-color);
  }
}
</style>
