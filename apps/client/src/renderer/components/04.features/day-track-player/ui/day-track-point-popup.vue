<script setup lang="ts">
import type { DayPoint, PointStatusBadge, SelectedPointInfo, TimezoneMode } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from '../models/types'

const props = defineProps<{
  selectedPoint: SelectedPointInfo | null
  timezoneMode: TimezoneMode
  formattedTime: string
  formattedEndTime?: string
  isCopied: boolean
  isDeleting: boolean
  statusBadge: PointStatusBadge | null
}>()

const emit = defineEmits<{
  (e: 'copy', point: DayPoint): void
  (e: 'delete', point: DayPoint): void
  (e: 'close'): void
}>()

const stopDuration = computed(() => {
  const stop = props.selectedPoint?.point?.stop
  if (!stop)
    return null
  const diffMs = Math.max(0, stop.endedAt - stop.startedAt)
  const totalMin = Math.round(diffMs / 60_000)
  if (totalMin < 1)
    return '< 1 мин'
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours > 0) {
    return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`
  }
  return `${mins} мин`
})

const pointActivity = computed(() => props.selectedPoint?.point?.activity ?? 'unknown')
const activityColor = computed(() => ACTIVITY_COLORS[pointActivity.value] || '#9e9e9e')
const activityIcon = computed(() => ACTIVITY_ICONS[pointActivity.value] || 'mdi:crosshairs-question')
const activityLabel = computed(() => ACTIVITY_LABELS[pointActivity.value] || 'Движение')

const speedFormatted = computed(() => {
  const sp = props.selectedPoint?.point?.speed
  if (sp == null)
    return '0.0 км/ч'
  return `${(sp * 3.6).toFixed(1)} км/ч`
})
</script>

<template>
  <div class="memories-popup">
    <div v-if="selectedPoint" class="point-popup-card">
      <!-- 1. Шапка: статус точки и действия -->
      <div class="popup-head">
        <div class="popup-title-group">
          <!-- Заголовок и бейдж -->
          <div class="title-meta">
            <template v-if="selectedPoint.point.stop">
              <span class="popup-index is-stop">Остановка</span>
              <span v-if="stopDuration" class="stop-duration-pill">
                <Icon icon="mdi:timer-outline" />
                {{ stopDuration }}
              </span>
            </template>
            <template v-else>
              <span class="popup-index">#{{ selectedPoint.index }}</span>
              <span class="total-pts">/ {{ selectedPoint.total }}</span>
              <span
                class="popup-act-badge"
                :style="{ '--act-color': activityColor }"
              >
                <Icon :icon="activityIcon" />
                <span>{{ activityLabel }}</span>
              </span>
            </template>
          </div>
        </div>

        <div class="popup-actions">
          <!-- Кнопка удаления (только для обычных точек маршрута) -->
          <button
            v-if="!selectedPoint.point.stop"
            class="popup-action-btn delete-btn"
            :disabled="isDeleting"
            title="Удалить эту точку и пересчитать маршрут"
            aria-label="Удалить точку"
            @click.stop="emit('delete', selectedPoint.point)"
          >
            <Icon v-if="isDeleting" icon="mdi:loading" class="spin" />
            <Icon v-else icon="mdi:trash-can-outline" />
          </button>

          <!-- Кнопка закрытия с удобной зоной нажатия -->
          <button
            class="popup-action-btn close-btn"
            aria-label="Закрыть"
            title="Закрыть"
            @click.stop="emit('close')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
      </div>

      <!-- 2. Временная плашка -->
      <div class="popup-time-row">
        <Icon icon="mdi:clock-outline" class="time-icon" />
        <span class="time-val">
          {{ formattedTime }}<template v-if="selectedPoint.point.stop"> – {{ formattedEndTime }}</template>
        </span>
        <span class="tz-pill">{{ timezoneMode === 'track' ? 'Местное' : 'Устройство' }}</span>
      </div>

      <!-- 3. Сетка ключевых параметров -->
      <div class="popup-grid">
        <!-- Скорость (для трека) -->
        <div v-if="!selectedPoint.point.stop" class="popup-item">
          <span class="item-lbl">
            <Icon icon="mdi:speedometer" />
            Скорость
          </span>
          <span class="item-val">{{ speedFormatted }}</span>
        </div>

        <!-- Замеры/Фиксы (для стоянки) -->
        <div v-else-if="selectedPoint.point.stop?.samplesCount" class="popup-item">
          <span class="item-lbl">
            <Icon icon="mdi:chart-scatter-plot" />
            Замеры
          </span>
          <span class="item-val">{{ selectedPoint.point.stop.samplesCount }} фикс.</span>
        </div>

        <!-- Точность GPS -->
        <div class="popup-item">
          <span class="item-lbl">
            <Icon icon="mdi:crosshairs-gps" />
            Точность GPS
          </span>
          <span class="item-val" :class="{ 'is-warning': (selectedPoint.point.accuracy ?? 0) > 30 }">
            {{ selectedPoint.point.accuracy == null ? '—' : `≈ ${Math.round(selectedPoint.point.accuracy)} м` }}
          </span>
        </div>

        <!-- Высота -->
        <div v-if="selectedPoint.point.altitude != null" class="popup-item">
          <span class="item-lbl">
            <Icon icon="mdi:image-filter-hdr" />
            Высота
          </span>
          <span class="item-val">{{ Math.round(selectedPoint.point.altitude) }} м</span>
        </div>

        <!-- Радиус остановки (если стоянка) или Курс (если есть азимут) -->
        <div v-if="selectedPoint.point.stop?.radiusM != null" class="popup-item">
          <span class="item-lbl">
            <Icon icon="mdi:circle-outline" />
            Радиус кластера
          </span>
          <span class="item-val">≈ {{ Math.round(selectedPoint.point.stop.radiusM) }} м</span>
        </div>
        <div v-else-if="selectedPoint.point.bearing != null && selectedPoint.point.bearing >= 0" class="popup-item">
          <span class="item-lbl">
            <Icon icon="mdi:compass-outline" />
            Курс
          </span>
          <span class="item-val">{{ Math.round(selectedPoint.point.bearing) }}°</span>
        </div>
      </div>

      <!-- 4. Интерактивная плашка координат (тап по всей площади для копирования) -->
      <button
        type="button"
        class="coords-card"
        :class="{ 'is-copied': isCopied }"
        :title="isCopied ? 'Скопировано в буфер!' : 'Нажмите, чтобы скопировать координаты'"
        @click.stop="emit('copy', selectedPoint.point)"
      >
        <div class="coords-left">
          <Icon icon="mdi:map-marker-outline" class="coords-pin" />
          <span class="coords-num font-mono">
            {{ selectedPoint.point.lat.toFixed(5) }}, {{ selectedPoint.point.lng.toFixed(5) }}
          </span>
        </div>

        <div class="coords-badge" :class="{ copied: isCopied }">
          <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
          <span v-if="isCopied">Скопировано</span>
        </div>
      </button>

      <!-- 5. Предупреждающий тег (только при аномалиях/предупреждениях) -->
      <div v-if="statusBadge && statusBadge.type !== 'valid'" class="popup-validity-tag" :class="statusBadge.type">
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
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 10px 14px;
    min-width: 250px;
    max-width: 310px;
    box-shadow: var(--s-l);
    color: var(--fg-primary-color);
    display: flex;
    flex-direction: column;
    gap: 9px;

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

    /* 1. Шапка */
    .popup-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;

      .popup-title-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;

        .title-meta {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .popup-index {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--fg-primary-color);

          &.is-stop {
            color: #f59e0b;
          }
        }

        .total-pts {
          font-size: 0.72rem;
          color: var(--fg-secondary-color);
          font-weight: 500;
        }

        .stop-duration-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: var(--r-full);
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .popup-act-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: var(--r-full);
          border: 1px solid color-mix(in srgb, var(--act-color, currentColor) 25%, transparent);
          background-color: color-mix(in srgb, var(--act-color, currentColor) 12%, transparent);
          color: var(--act-color, currentColor);
        }
      }

      .popup-actions {
        display: flex;
        align-items: center;
        gap: 2px;

        .popup-action-btn {
          position: relative;
          width: 28px;
          height: 28px;
          border-radius: var(--r-full);
          border: none;
          background: transparent;
          color: var(--fg-secondary-color);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          font-size: 1rem;
          transition: all 0.15s ease;

          /* Расширенный touch target для мобильных без визуального увеличения */
          &::before {
            content: '';
            position: absolute;
            top: -5px;
            bottom: -5px;
            left: -5px;
            right: -5px;
          }

          &:hover:not(:disabled) {
            color: var(--fg-primary-color);
            background: var(--bg-hover-color);
          }

          &:active:not(:disabled) {
            transform: scale(0.92);
          }

          &.delete-btn {
            &:hover:not(:disabled) {
              color: var(--fg-error-color);
              background: rgba(239, 68, 68, 0.15);
            }
          }

          &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
        }
      }
    }

    /* 2. Строка времени */
    .popup-time-row {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 7px;
      background: var(--bg-tertiary-color);
      border-radius: var(--r-xs);
      font-size: 0.74rem;

      .time-icon {
        color: var(--fg-secondary-color);
        font-size: 0.85rem;
        flex-shrink: 0;
      }

      .time-val {
        font-weight: 600;
        color: var(--fg-primary-color);
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tz-pill {
        font-size: 0.65rem;
        color: var(--fg-secondary-color);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        font-weight: 600;
        opacity: 0.85;
      }
    }

    /* 3. Сетка параметров */
    .popup-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 10px;

      .popup-item {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .item-lbl {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 0.68rem;
          color: var(--fg-secondary-color);

          :deep(svg) {
            font-size: 0.78rem;
            opacity: 0.8;
          }
        }

        .item-val {
          font-size: 0.79rem;
          font-weight: 600;
          color: var(--fg-primary-color);

          &.is-warning {
            color: var(--fg-warning-color);
          }
        }
      }
    }

    /* 4. Интерактивная плашка координат */
    .coords-card {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 5px 8px;
      background: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-xs);
      cursor: pointer;
      color: var(--fg-primary-color);
      transition: all 0.2s ease;
      min-height: 32px;

      &:hover {
        background: var(--bg-hover-color);
        border-color: var(--border-primary-color);
      }

      &:active {
        transform: scale(0.98);
      }

      &.is-copied {
        border-color: rgba(34, 197, 94, 0.4);
        background: rgba(34, 197, 94, 0.08);
      }

      .coords-left {
        display: flex;
        align-items: center;
        gap: 5px;

        .coords-pin {
          color: var(--fg-secondary-color);
          font-size: 0.85rem;
        }

        .coords-num {
          font-family: monospace;
          font-size: 0.74rem;
          font-weight: 600;
        }
      }

      .coords-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.68rem;
        font-weight: 600;
        color: var(--fg-secondary-color);
        padding: 2px 5px;
        border-radius: var(--r-xs);
        transition: all 0.2s ease;

        &.copied {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.15);
        }
      }
    }

    /* 5. Тег предупреждения / ошибки */
    .popup-validity-tag {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.7rem;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: var(--r-xs);
      margin-top: 1px;

      &.flight {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
      }

      &.warning {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
    }

    @media (max-width: 640px) {
      min-width: 230px;
      max-width: calc(100vw - 32px);
      padding: 8px 12px;
      gap: 7px;

      .popup-head {
        .popup-actions {
          .popup-action-btn {
            width: 30px;
            height: 30px;
          }
        }
      }

      .coords-card {
        padding: 6px 8px;
        min-height: 36px;
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
