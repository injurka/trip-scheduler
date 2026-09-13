<script setup lang="ts">
import type { OfflineDownloadOptions } from '~/shared/store/offline.store'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
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
const isAllSelected = computed(() => selectedCount.value === totalAvailableOptions.value)

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
    title="Офлайн-сохранение"
    icon="mdi:cloud-download-outline"
    :max-width="540"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="offline-download-dialog">
      <!-- Контекстная карточка поездки -->
      <div class="dialog-hero">
        <div class="trip-destination">
          <div class="destination-icon">
            <Icon icon="mdi:map-marker-radius" />
          </div>
          <span class="trip-name">{{ tripTitle }}</span>
        </div>
        <p class="dialog-lead">
          Выберите данные, которые необходимо сохранить в память устройства для полноценной автономной работы без доступа к интернету.
        </p>
      </div>

      <!-- Панель счетчика и быстрых действий -->
      <div class="selection-control-bar">
        <div class="counter-chip" :class="{ 'is-empty': isNoneSelected }">
          <span class="counter-dot" />
          <span class="counter-text">
            Выбрано: <strong>{{ selectedCount }}</strong> из {{ totalAvailableOptions }}
          </span>
        </div>

        <div class="quick-actions">
          <button
            type="button"
            class="quick-action-btn"
            :disabled="isAllSelected"
            @click="selectAll"
          >
            <Icon icon="mdi:check-all" />
            <span>Выбрать все</span>
          </button>
          <span class="actions-divider" />
          <button
            type="button"
            class="quick-action-btn"
            :disabled="isNoneSelected"
            @click="deselectAll"
          >
            <Icon icon="mdi:close" />
            <span>Снять все</span>
          </button>
        </div>
      </div>

      <!-- Список интерактивных карточек опций -->
      <div class="options-list">
        <!-- 1. Медиа и фото -->
        <div
          class="option-card"
          :class="{ 'is-active': includeMedia }"
          role="checkbox"
          :aria-checked="includeMedia"
          tabindex="0"
          @click="includeMedia = !includeMedia"
          @keydown.space.prevent="includeMedia = !includeMedia"
          @keydown.enter.prevent="includeMedia = !includeMedia"
        >
          <div class="option-icon-box type-media" aria-hidden="true">
            <Icon icon="mdi:image-multiple-outline" />
          </div>
          <div class="option-content">
            <div class="option-header">
              <span class="option-title">Медиа и фотографии</span>
              <span class="option-tag tag-media">Фото и галереи</span>
            </div>
            <span class="option-description">Обложки, фотографии дней, галереи и аватары</span>
          </div>
          <div
            class="option-check-box"
            :class="{ 'is-checked': includeMedia }"
            aria-hidden="true"
          >
            <Icon v-if="includeMedia" icon="mdi:check" class="check-icon" />
          </div>
        </div>

        <!-- 2. Заметки -->
        <div
          class="option-card"
          :class="{ 'is-active': includeNotes }"
          role="checkbox"
          :aria-checked="includeNotes"
          tabindex="0"
          @click="includeNotes = !includeNotes"
          @keydown.space.prevent="includeNotes = !includeNotes"
          @keydown.enter.prevent="includeNotes = !includeNotes"
        >
          <div class="option-icon-box type-notes" aria-hidden="true">
            <Icon icon="mdi:notebook-outline" />
          </div>
          <div class="option-content">
            <div class="option-header">
              <span class="option-title">Заметки поездки</span>
              <span class="option-tag tag-notes">Заметки и списки</span>
            </div>
            <span class="option-description">Текстовые заметки, списки дел и вложенные фото</span>
          </div>
          <div
            class="option-check-box"
            :class="{ 'is-checked': includeNotes }"
            aria-hidden="true"
          >
            <Icon v-if="includeNotes" icon="mdi:check" class="check-icon" />
          </div>
        </div>

        <!-- 3. Документы и билеты -->
        <div
          class="option-card"
          :class="{ 'is-active': includeDocuments }"
          role="checkbox"
          :aria-checked="includeDocuments"
          tabindex="0"
          @click="includeDocuments = !includeDocuments"
          @keydown.space.prevent="includeDocuments = !includeDocuments"
          @keydown.enter.prevent="includeDocuments = !includeDocuments"
        >
          <div class="option-icon-box type-docs" aria-hidden="true">
            <Icon icon="mdi:file-document-outline" />
          </div>
          <div class="option-content">
            <div class="option-header">
              <span class="option-title">Документы и билеты</span>
              <span class="option-tag tag-docs">PDF и ваучеры</span>
            </div>
            <span class="option-description">PDF-ваучеры, бронирования отелей, билеты и файлы</span>
          </div>
          <div
            class="option-check-box"
            :class="{ 'is-checked': includeDocuments }"
            aria-hidden="true"
          >
            <Icon v-if="includeDocuments" icon="mdi:check" class="check-icon" />
          </div>
        </div>

        <!-- 4. Карта зоны маршрута -->
        <div
          class="option-card"
          :class="{
            'is-active': hasCoordinates && includeMapTiles,
            'is-disabled': !hasCoordinates,
          }"
          role="checkbox"
          :aria-checked="hasCoordinates && includeMapTiles"
          :aria-disabled="!hasCoordinates"
          :tabindex="hasCoordinates ? 0 : -1"
          @click="hasCoordinates && (includeMapTiles = !includeMapTiles)"
          @keydown.space.prevent="hasCoordinates && (includeMapTiles = !includeMapTiles)"
          @keydown.enter.prevent="hasCoordinates && (includeMapTiles = !includeMapTiles)"
        >
          <div class="option-icon-box type-map" aria-hidden="true">
            <Icon icon="mdi:map-marker-radius-outline" />
          </div>
          <div class="option-content">
            <div class="option-header">
              <span class="option-title">Карта зоны маршрута</span>
              <span class="option-tag tag-map">
                {{ hasCoordinates ? 'Векторные тайлы' : 'Недоступно' }}
              </span>
            </div>
            <span class="option-description">
              {{ hasCoordinates ? 'Векторные тайлы и рельеф зоны поездки (зум 10–15)' : 'В маршруте нет гео-точек для скачивания' }}
            </span>
          </div>
          <div
            class="option-check-box"
            :class="{ 'is-checked': hasCoordinates && includeMapTiles }"
            aria-hidden="true"
          >
            <Icon v-if="hasCoordinates && includeMapTiles" icon="mdi:check" class="check-icon" />
          </div>
        </div>
      </div>

      <!-- Информационная плашка безопасности/автономности -->
      <div class="dialog-footer-hint">
        <Icon icon="mdi:shield-airplane-outline" class="hint-icon" />
        <span class="hint-text">Сохраненные данные будут доступны в приложении без подключения к сети и в авиарежиме.</span>
      </div>

      <!-- Кнопки действий -->
      <div class="dialog-actions">
        <KitBtn variant="outlined" @click="handleCancel">
          Отмена
        </KitBtn>
        <KitBtn
          color="primary"
          :disabled="isNoneSelected"
          @click="handleConfirm"
        >
          <Icon icon="mdi:download-outline" />
          <span>Скачать{{ selectedCount > 0 ? ` (${selectedCount})` : '' }}</span>
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
  padding: 2px 0 4px;
}

// Карточка-хедер с контекстом поездки
.dialog-hero {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  .trip-destination {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    .destination-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--accent-color, #ff8856) 18%, transparent);
      color: var(--accent-color, #ff8856);
      font-size: 0.95rem;
      flex-shrink: 0;
    }

    .trip-name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--fg-primary-color);
      letter-spacing: -0.01em;
    }
  }

  .dialog-lead {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    line-height: 1.45;
  }
}

// Панель счетчика и быстрых действий
.selection-control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;

  .counter-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 20px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    font-size: 0.82rem;
    color: var(--fg-secondary-color);
    user-select: none;

    .counter-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      transition: background-color 0.2s ease;
    }

    &.is-empty .counter-dot {
      background: var(--fg-muted-color, #888);
    }

    strong {
      color: var(--fg-primary-color);
      font-weight: 600;
    }
  }

  .quick-actions {
    display: flex;
    align-items: center;
    gap: 6px;

    .actions-divider {
      width: 1px;
      height: 14px;
      background: var(--border-secondary-color);
    }

    .quick-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 9px;
      border-radius: 8px;
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      color: var(--fg-secondary-color);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.18s ease;

      &:hover:not(:disabled) {
        color: var(--fg-primary-color);
        background: var(--bg-tertiary-color);
        border-color: var(--border-primary-color);
      }

      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    }
  }
}

// Список интерактивных карточек
.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1.5px solid var(--border-secondary-color);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(.is-disabled) {
    background: var(--bg-tertiary-color);
    border-color: var(--border-primary-color);
    transform: translateY(-1px);
  }

  &:focus-visible:not(.is-disabled) {
    border-color: var(--accent-color, #ff8856);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color, #ff8856) 25%, transparent);
  }

  &.is-active {
    border-color: var(--accent-color, #ff8856);
    background: color-mix(in srgb, var(--accent-color, #ff8856) 6%, var(--bg-secondary-color));
  }

  &.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: var(--bg-secondary-color);
    border-color: var(--border-secondary-color);
  }

  .option-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    font-size: 1.3rem;
    flex-shrink: 0;
    transition: transform 0.2s ease;

    &.type-media {
      background: rgba(139, 92, 246, 0.14);
      color: #a78bfa;
    }

    &.type-notes {
      background: rgba(245, 158, 11, 0.14);
      color: #fbbf24;
    }

    &.type-docs {
      background: rgba(16, 185, 129, 0.14);
      color: #34d399;
    }

    &.type-map {
      background: rgba(14, 165, 233, 0.14);
      color: #38bdf8;
    }
  }

  &:hover:not(.is-disabled) .option-icon-box {
    transform: scale(1.05);
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;

    .option-header {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
      min-width: 0;

      .option-title {
        font-size: 0.94rem;
        font-weight: 600;
        color: var(--fg-primary-color);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .option-tag {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 6px;
        letter-spacing: 0.01em;
        white-space: nowrap;
        flex-shrink: 0;

        &.tag-media {
          background: rgba(139, 92, 246, 0.12);
          color: #c4b5fd;
        }

        &.tag-notes {
          background: rgba(245, 158, 11, 0.12);
          color: #fcd34d;
        }

        &.tag-docs {
          background: rgba(16, 185, 129, 0.12);
          color: #6ee7b7;
        }

        &.tag-map {
          background: rgba(14, 165, 233, 0.12);
          color: #7dd3fc;
        }
      }
    }

    .option-description {
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  // Визуальный чекбокс-индикатор
  .option-check-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 1.5px solid var(--border-primary-color);
    background: var(--bg-primary-color);
    color: #ffffff;
    flex-shrink: 0;
    transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);

    .check-icon {
      font-size: 0.95rem;
    }

    &.is-checked {
      background: var(--accent-color, #ff8856);
      border-color: var(--accent-color, #ff8856);
    }
  }

  &:hover:not(.is-disabled) .option-check-box:not(.is-checked) {
    border-color: var(--accent-color, #ff8856);
  }
}

// Подсказка об автономности
.dialog-footer-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);

  .hint-icon {
    font-size: 1.15rem;
    color: var(--accent-color, #ff8856);
    flex-shrink: 0;
  }

  .hint-text {
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
    line-height: 1.4;
  }
}

// Кнопки управления
.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 2px;
}

// Адаптивность для мобильных экранов
@media (max-width: 480px) {
  .offline-download-dialog {
    gap: 12px;
  }

  .dialog-hero {
    padding: 10px 12px;
  }

  .selection-control-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;

    .quick-actions {
      align-self: flex-end;
    }
  }

  .option-card {
    gap: 10px;
    padding: 10px 12px;

    .option-icon-box {
      width: 36px;
      height: 36px;
      font-size: 1.15rem;
    }

    .option-content {
      .option-header {
        flex-wrap: wrap;
        gap: 4px;

        .option-title {
          font-size: 0.88rem;
          white-space: normal;
        }

        .option-tag {
          font-size: 0.68rem;
          padding: 1px 5px;
        }
      }

      .option-description {
        font-size: 0.75rem;
      }
    }
  }
}
</style>
