<script setup lang="ts">
import type { OfflineDownloadOptions } from '~/shared/store/offline.store'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'

interface Props {
  visible: boolean
  tripTitle?: string
  hasCoordinates?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tripTitle: 'Путешествие',
  hasCoordinates: true,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', options: OfflineDownloadOptions): void
}>()

const includeMedia = ref(true)
const includeNotes = ref(true)
const includeDocuments = ref(true)
const includeMapTiles = ref(props.hasCoordinates)

watch(
  () => props.visible,
  (isOpen) => {
    if (isOpen) {
      includeMedia.value = true
      includeNotes.value = true
      includeDocuments.value = true
      includeMapTiles.value = props.hasCoordinates
    }
  },
)

const totalAvailableOptions = computed(() => (props.hasCoordinates ? 4 : 3))

const selectedCount = computed(() => {
  let count = 0
  if (includeMedia.value)
    count++
  if (includeNotes.value)
    count++
  if (includeDocuments.value)
    count++
  if (props.hasCoordinates && includeMapTiles.value)
    count++
  return count
})

const isNoneSelected = computed(() => selectedCount.value === 0)

function selectAll() {
  includeMedia.value = true
  includeNotes.value = true
  includeDocuments.value = true
  if (props.hasCoordinates) {
    includeMapTiles.value = true
  }
}

function deselectAll() {
  includeMedia.value = false
  includeNotes.value = false
  includeDocuments.value = false
  includeMapTiles.value = false
}

function handleConfirm() {
  if (isNoneSelected.value)
    return

  emit('confirm', {
    includeMedia: includeMedia.value,
    includeNotes: includeNotes.value,
    includeDocuments: includeDocuments.value,
    includeMapTiles: props.hasCoordinates ? includeMapTiles.value : false,
  })
  emit('update:visible', false)
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Офлайн скачивание"
    icon="mdi:cloud-download-outline"
    :max-width="520"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="offline-download-dialog">
      <div class="dialog-header-info">
        <p class="trip-name">
          {{ tripTitle }}
        </p>
        <span class="dialog-desc">
          Выберите, какие компоненты поездки вы хотите сохранить в память устройства для автономной работы:
        </span>
      </div>

      <div class="selection-control-bar">
        <span class="selection-counter">
          Выбрано: {{ selectedCount }} из {{ totalAvailableOptions }}
        </span>
        <div class="selection-buttons">
          <button type="button" class="action-link" @click="selectAll">
            Выбрать все
          </button>
          <span class="separator">•</span>
          <button type="button" class="action-link" @click="deselectAll">
            Снять все
          </button>
        </div>
      </div>

      <div class="options-list">
        <div class="option-item" @click="includeMedia = !includeMedia">
          <div class="option-checkbox" @click.stop>
            <KitCheckbox v-model="includeMedia" />
          </div>
          <div class="option-icon-wrap">
            <Icon icon="mdi:image-multiple-outline" class="option-icon" />
          </div>
          <div class="option-text">
            <span class="option-title">Медиа и фотографии</span>
            <span class="option-sub">Обложки, фото дней, вложения и аватары</span>
          </div>
        </div>

        <div class="option-item" @click="includeNotes = !includeNotes">
          <div class="option-checkbox" @click.stop>
            <KitCheckbox v-model="includeNotes" />
          </div>
          <div class="option-icon-wrap">
            <Icon icon="mdi:notebook-outline" class="option-icon" />
          </div>
          <div class="option-text">
            <span class="option-title">Заметки поездки</span>
            <span class="option-sub">Текстовые заметки, списки и вложенные фото</span>
          </div>
        </div>

        <div class="option-item" @click="includeDocuments = !includeDocuments">
          <div class="option-checkbox" @click.stop>
            <KitCheckbox v-model="includeDocuments" />
          </div>
          <div class="option-icon-wrap">
            <Icon icon="mdi:file-document-outline" class="option-icon" />
          </div>
          <div class="option-text">
            <span class="option-title">Документы и билеты</span>
            <span class="option-sub">PDF ваучеры, бронирования и билеты</span>
          </div>
        </div>

        <div
          class="option-item"
          :class="{ 'is-disabled': !hasCoordinates }"
          @click="hasCoordinates && (includeMapTiles = !includeMapTiles)"
        >
          <div class="option-checkbox" @click.stop>
            <KitCheckbox v-model="includeMapTiles" :disabled="!hasCoordinates" />
          </div>
          <div class="option-icon-wrap map-icon-wrap">
            <Icon icon="mdi:map-outline" class="option-icon" />
          </div>
          <div class="option-text">
            <span class="option-title">Тайлы карты зоны маршрута</span>
            <span class="option-sub">
              {{ hasCoordinates ? 'Предзагрузка векторных тайлов и рельефа (зум 10–15)' : 'В маршруте нет гео-точек' }}
            </span>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <KitBtn variant="outlined" @click="handleCancel">
          Отмена
        </KitBtn>
        <KitBtn color="primary" :disabled="isNoneSelected" @click="handleConfirm">
          <Icon icon="mdi:download" />
          <span>Скачать</span>
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.offline-download-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.dialog-header-info {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .trip-name {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .dialog-desc {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    line-height: 1.4;
  }
}

.selection-control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
  font-size: 0.85rem;

  .selection-counter {
    color: var(--fg-secondary-color);
    font-weight: 500;
  }

  .selection-buttons {
    display: flex;
    align-items: center;
    gap: 8px;

    .separator {
      color: var(--border-color);
      user-select: none;
    }

    .action-link {
      background: none;
      border: none;
      padding: 0;
      color: var(--accent-color, #3b82f6);
      font-size: 0.85rem;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 0.8;
      }
    }
  }
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.is-disabled) {
    background-color: var(--bg-tertiary-color);
    border-color: var(--border-hover-color);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.option-checkbox {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.option-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  flex-shrink: 0;

  &.map-icon-wrap {
    color: var(--accent-color, #3b82f6);
  }

  .option-icon {
    font-size: 1.25rem;
  }
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .option-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .option-sub {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 4px;
}
</style>
