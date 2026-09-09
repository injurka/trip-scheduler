<script setup lang="ts">
import type { DayPoint, PointStatusBadge, SelectedPointInfo, TimezoneMode } from '../models/types'
import { Icon } from '@iconify/vue'
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from '../models/types'

defineProps<{
  selectedPoint: SelectedPointInfo | null
  timezoneMode: TimezoneMode
  formattedTime: string
  isCopied: boolean
  isDeleting: boolean
  statusBadge: PointStatusBadge | null
}>()

const emit = defineEmits<{
  (e: 'copy', point: DayPoint): void
  (e: 'delete', point: DayPoint): void
  (e: 'close'): void
}>()
</script>

<template>
  <div class="memories-popup">
    <div v-if="selectedPoint" class="point-popup-card">
      <div class="popup-head">
        <div class="popup-title-group">
          <span class="popup-index">Точка #{{ selectedPoint.index }} из {{ selectedPoint.total }}</span>
          <span
            class="popup-act-badge"
            :style="{
              backgroundColor: `${ACTIVITY_COLORS[selectedPoint.point.activity]}20`,
              color: ACTIVITY_COLORS[selectedPoint.point.activity],
            }"
          >
            <Icon :icon="ACTIVITY_ICONS[selectedPoint.point.activity]" />
            {{ ACTIVITY_LABELS[selectedPoint.point.activity] }}
          </span>
        </div>

        <div class="popup-actions">
          <!-- Кнопка удаления точки с автоматической нормализацией маршрута -->
          <button
            class="popup-action-btn delete-btn"
            :disabled="isDeleting"
            title="Удалить эту точку и пересчитать маршрут"
            aria-label="Удалить точку"
            @click.stop="emit('delete', selectedPoint.point)"
          >
            <Icon v-if="isDeleting" icon="mdi:loading" class="spin" />
            <Icon v-else icon="mdi:trash-can-outline" />
          </button>

          <!-- Кнопка закрытия попапа -->
          <button class="popup-action-btn close-btn" aria-label="Закрыть" @click.stop="emit('close')">
            <Icon icon="mdi:close" />
          </button>
        </div>
      </div>

      <div class="popup-grid">
        <div class="popup-item">
          <span class="item-lbl">Время ({{ timezoneMode === 'track' ? 'Местное' : 'Локальное' }})</span>
          <span class="item-val">{{ formattedTime }}</span>
        </div>
        <div class="popup-item">
          <span class="item-lbl">Скорость</span>
          <span class="item-val">
            {{ selectedPoint.point.speed !== null ? `${(selectedPoint.point.speed * 3.6).toFixed(1)} км/ч` : 'Покой' }}
          </span>
        </div>
        <div class="popup-item">
          <span class="item-lbl">Точность GPS</span>
          <span class="item-val" :class="{ 'is-warning': (selectedPoint.point.accuracy ?? 0) > 30 }">
            ±{{ Math.round(selectedPoint.point.accuracy ?? 0) }} м
          </span>
        </div>
        <div v-if="selectedPoint.point.altitude != null" class="popup-item">
          <span class="item-lbl">Высота</span>
          <span class="item-val">{{ Math.round(selectedPoint.point.altitude) }} м</span>
        </div>
        <div class="popup-item popup-coords">
          <span class="item-lbl">Координаты</span>
          <div class="coords-row">
            <span class="item-val font-mono">{{ selectedPoint.point.lat.toFixed(5) }}, {{ selectedPoint.point.lng.toFixed(5) }}</span>
            <button
              class="copy-coords-btn"
              :title="isCopied ? 'Скопировано!' : 'Скопировать координаты'"
              @click.stop="emit('copy', selectedPoint.point)"
            >
              <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="statusBadge" class="popup-validity-tag" :class="statusBadge.type">
        <Icon :icon="statusBadge.icon" />
        <span>{{ statusBadge.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-popup {
  position: relative;
  pointer-events: auto;
  z-index: 30;

  .point-popup-card {
    position: relative;
    background-color: var(--bg-secondary-color);
    backdrop-filter: blur(14px);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 10px 14px;
    min-width: 230px;
    max-width: 290px;
    box-shadow: var(--s-l);
    color: var(--fg-primary-color);
    display: flex;
    flex-direction: column;
    gap: 8px;

    &::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 6px 6px 0 6px;
      border-style: solid;
      border-color: var(--bg-secondary-color) transparent transparent transparent;
    }

    .popup-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      .popup-title-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;

        .popup-index {
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--fg-secondary-color);
        }

        .popup-act-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 10px;
        }
      }

      .popup-actions {
        display: flex;
        align-items: center;
        gap: 4px;

        .popup-action-btn {
          width: 24px;
          height: 24px;
          border-radius: var(--r-full);
          border: none;
          background: transparent;
          color: var(--fg-secondary-color);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          font-size: 0.95rem;
          transition: all 0.2s;

          &:hover:not(:disabled) {
            color: var(--fg-primary-color);
            background: var(--bg-hover-color);
          }

          &.delete-btn {
            &:hover:not(:disabled) {
              color: var(--fg-error-color);
              background: rgba(239, 68, 68, 0.15);
            }
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }

    .popup-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 10px;
      font-size: 0.78rem;

      .popup-item {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .item-lbl {
          font-size: 0.68rem;
          color: var(--fg-secondary-color);
        }

        .item-val {
          font-weight: 500;
          color: var(--fg-primary-color);

          &.is-warning {
            color: var(--fg-warning-color);
          }
        }

        &.popup-coords {
          grid-column: 1 / -1;

          .coords-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;

            .font-mono {
              font-family: monospace;
              font-size: 0.74rem;
            }

            .copy-coords-btn {
              background: transparent;
              border: none;
              color: var(--fg-secondary-color);
              cursor: pointer;
              padding: 2px;
              display: flex;
              align-items: center;
              border-radius: var(--r-xs);
              font-size: 0.85rem;
              transition: color 0.2s;

              &:hover {
                color: var(--fg-primary-color);
              }
            }
          }
        }
      }
    }

    .popup-validity-tag {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.7rem;
      font-weight: 500;
      padding: 3px 7px;
      border-radius: var(--r-xs);
      margin-top: 2px;
      background: var(--bg-tertiary-color);
      color: var(--fg-secondary-color);

      &.flight {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
      }

      &.warning {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      &.valid {
        background: rgba(34, 197, 94, 0.15);
        color: #22c55e;
      }
    }

    @media (max-width: 640px) {
      min-width: 210px;
      max-width: calc(100vw - 32px);
      padding: 8px 12px;
      gap: 6px;

      .popup-grid {
        gap: 4px 8px;

        .popup-item {
          .item-val {
            font-size: 0.74rem;
          }
        }
      }
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
</style>
