<script setup lang="ts">
import type { ActivityType } from '~/shared/services/tracking/geotrack-client'
import { Icon } from '@iconify/vue'
import { useToast } from '~/shared/composables/use-toast'
import { useTrackingStore } from '~/shared/store/tracking.store'

const emit = defineEmits<{
  (e: 'changed', running: boolean): void
}>()

const tracking = useTrackingStore()
const toast = useToast()

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  still: 'Покой',
  walk: 'Пешком',
  bike: 'Велосипед',
  vehicle: 'Авто',
  rail: 'Поезд',
  unknown: 'Определение...',
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  still: 'mdi:motion-pause-outline',
  walk: 'mdi:walk',
  bike: 'mdi:bike',
  vehicle: 'mdi:car-outline',
  rail: 'mdi:train',
  unknown: 'mdi:crosshairs-question',
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  still: '#9e9e9e',
  walk: '#4caf50',
  bike: '#ff9800',
  vehicle: '#2196f3',
  rail: '#9c27b0',
  unknown: '#78909c',
}

onMounted(() => {
  void tracking.startPolling()
})

onBeforeUnmount(() => {
  tracking.stopPolling()
})

async function onToggle(e: Event) {
  const target = e.target as HTMLInputElement
  const enable = target.checked
  try {
    await tracking.toggle(enable)
    if (enable) {
      toast.success('Фоновый трекинг запущен: координаты и активность записываются.')
    }
    else {
      toast.info('Трекинг приостановлен: точки сохранены и отправляются на сервер.')
    }
    emit('changed', enable)
  }
  catch {
    target.checked = tracking.isRunning
    toast.error(tracking.lastError || 'Не удалось переключить статус GPS-трекинга.')
  }
}

async function handleManualSync() {
  const count = await tracking.syncNow()
  if (count > 0) {
    toast.success(`Синхронизировано ${count} точек с сервером!`)
    emit('changed', tracking.isRunning)
  }
  else if (!tracking.lastError) {
    toast.info('Буфер пуст, все точки уже синхронизированы.')
  }
}

function formatSyncTime(ts: number | null): string {
  if (!ts)
    return ''
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div v-if="tracking.canToggle" class="tracking-card">
    <div class="tracking-header">
      <div class="header-left">
        <div class="icon-avatar" :class="{ 'is-active': tracking.isRunning }">
          <Icon icon="mdi:crosshairs-gps" class="gps-icon" />
          <span v-if="tracking.isRunning" class="live-dot" />
        </div>
        <div class="title-group">
          <div class="title-row">
            <span class="card-title">GPS-трекинг маршрута</span>
            <span
              class="status-badge"
              :class="{
                'is-running': tracking.isRunning,
                'is-starting': tracking.isStarting,
                'is-error': tracking.hasPermissionDenied || (tracking.lastError && !tracking.isRunning),
              }"
            >
              <template v-if="tracking.isStarting">
                <Icon icon="mdi:loading" class="spin" />
                Подключение...
              </template>
              <template v-else-if="tracking.isRunning">
                <span class="pulse-indicator" />
                Запись активна
              </template>
              <template v-else-if="tracking.hasPermissionDenied">
                <Icon icon="mdi:alert-circle-outline" />
                Доступ ограничен
              </template>
              <template v-else>
                Не активен
              </template>
            </span>
          </div>
          <span class="card-subtitle">
            <template v-if="tracking.isRunning">
              Запись перемещений в фоновом режиме с автоопределением активности
            </template>
            <template v-else>
              Маршруты дня автоматически сохраняются в «Воспоминания»
            </template>
          </span>
        </div>
      </div>

      <div class="header-right">
        <label class="switch" :title="tracking.isRunning ? 'Выключить трекинг' : 'Включить трекинг'">
          <input
            type="checkbox"
            :checked="tracking.isRunning"
            :disabled="tracking.isStarting"
            @change="onToggle"
          >
          <span class="slider" />
        </label>
      </div>
    </div>

    <!-- Предупреждение об ошибке или отсутствии разрешений -->
    <div v-if="tracking.lastError || tracking.hasPermissionDenied" class="error-banner">
      <Icon icon="mdi:alert-circle" class="error-icon" />
      <div class="error-text">
        <div class="error-title">
          {{ tracking.hasPermissionDenied ? 'Геолокация заблокирована' : 'Ошибка геолокации' }}
        </div>
        <div class="error-desc">
          {{ tracking.lastError || 'Разрешите доступ к геопозиции в настройках браузера или операционной системы.' }}
        </div>
      </div>
      <button class="clear-error-btn" @click="tracking.clearError">
        <Icon icon="mdi:close" />
      </button>
    </div>

    <!-- Панель живой телеметрии во время активной записи -->
    <div v-if="tracking.hasTelemetry" class="telemetry-panel">
      <div class="telemetry-grid">
        <div class="telemetry-item">
          <span class="telemetry-label">
            <Icon icon="mdi:speedometer" class="item-icon" />
            Скорость
          </span>
          <span class="telemetry-value">
            {{ tracking.telemetry.speedKmh !== null ? `${tracking.telemetry.speedKmh} км/ч` : '0 км/ч' }}
          </span>
        </div>

        <div class="telemetry-item">
          <span class="telemetry-label">
            <Icon icon="mdi:map-marker-distance" class="item-icon" />
            Пройдено
          </span>
          <span class="telemetry-value">
            {{ tracking.formattedDistance }}
          </span>
        </div>

        <div class="telemetry-item">
          <span class="telemetry-label">
            <Icon icon="mdi:timer-outline" class="item-icon" />
            Время в пути
          </span>
          <span class="telemetry-value font-mono">
            {{ tracking.formattedDuration }}
          </span>
        </div>

        <div class="telemetry-item">
          <span class="telemetry-label">
            <Icon :icon="ACTIVITY_ICONS[tracking.telemetry.activity]" class="item-icon" :style="{ color: ACTIVITY_COLORS[tracking.telemetry.activity] }" />
            Активность
          </span>
          <span class="telemetry-value activity-tag" :style="{ color: ACTIVITY_COLORS[tracking.telemetry.activity] }">
            {{ ACTIVITY_LABELS[tracking.telemetry.activity] }}
          </span>
        </div>

        <div class="telemetry-item">
          <span class="telemetry-label">
            <Icon icon="mdi:crosshairs-gps" class="item-icon" />
            Точность GPS
          </span>
          <span
            class="telemetry-value accuracy-badge"
            :class="tracking.accuracyQuality"
          >
            {{ tracking.telemetry.accuracyM !== null ? `±${tracking.telemetry.accuracyM} м` : 'Поиск...' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Футер синхронизации буфера с сервером -->
    <div class="sync-bar">
      <div class="sync-status">
        <template v-if="tracking.unsentCount > 0">
          <span class="sync-dot unsent" />
          <span class="sync-text">В локальном буфере: <strong>{{ tracking.unsentCount }}</strong> точек</span>
        </template>
        <template v-else>
          <span class="sync-dot synced" />
          <span class="sync-text">Все точки синхронизированы</span>
        </template>

        <span v-if="tracking.lastSyncAt" class="sync-time">
          · Синхр. в {{ formatSyncTime(tracking.lastSyncAt) }}
        </span>
      </div>

      <KitBtn
        variant="tonal"
        size="xs"
        :loading="tracking.isSyncing"
        :disabled="tracking.isSyncing || tracking.unsentCount === 0"
        @click="handleManualSync"
      >
        <template #prepend>
          <Icon icon="mdi:sync" :class="{ spin: tracking.isSyncing }" />
        </template>
        {{ tracking.isSyncing ? 'Отправка...' : 'Синхронизировать' }}
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tracking-card {
  background: var(--surface-color, #1e1e1e);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-m, 14px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--border-hover-color, rgba(255, 255, 255, 0.18));
  }
}

.tracking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon-avatar {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-hover-color, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
    color: var(--fg-secondary-color, #aaa);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    .gps-icon {
      font-size: 1.4rem;
    }

    &.is-active {
      background: rgba(76, 175, 80, 0.15);
      border-color: rgba(76, 175, 80, 0.4);
      color: var(--primary, #4caf50);

      .live-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #4caf50;
        border: 2px solid var(--surface-color, #1e1e1e);
        animation: pulse 1.6s infinite;
      }
    }
  }

  .title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--fg-color, #fff);
    }

    .card-subtitle {
      font-size: 0.82rem;
      color: var(--fg-secondary-color, rgba(255, 255, 255, 0.65));
      line-height: 1.3;
    }
  }
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  color: var(--fg-secondary-color, #aaa);
  border: 1px solid rgba(255, 255, 255, 0.08);

  &.is-running {
    background: rgba(76, 175, 80, 0.15);
    color: #81c784;
    border-color: rgba(76, 175, 80, 0.3);

    .pulse-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4caf50;
      animation: pulse 1.5s infinite;
    }
  }

  &.is-starting {
    background: rgba(255, 152, 0, 0.15);
    color: #ffb74d;
    border-color: rgba(255, 152, 0, 0.3);
  }

  &.is-error {
    background: rgba(244, 67, 54, 0.15);
    color: #e57373;
    border-color: rgba(244, 67, 54, 0.3);
  }
}

.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.25);
  border-radius: 8px;
  color: #ffcdd2;

  .error-icon {
    font-size: 1.2rem;
    color: #e57373;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .error-text {
    flex: 1;
    font-size: 0.8rem;

    .error-title {
      font-weight: 600;
      margin-bottom: 2px;
      color: #ef9a9a;
    }

    .error-desc {
      opacity: 0.9;
      line-height: 1.35;
    }
  }

  .clear-error-btn {
    background: transparent;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;

    &:hover {
      opacity: 1;
    }
  }
}

.telemetry-panel {
  padding: 12px;
  background: var(--bg-hover-color, rgba(255, 255, 255, 0.03));
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));

  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 12px;
  }

  .telemetry-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .telemetry-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      color: var(--fg-secondary-color, rgba(255, 255, 255, 0.6));

      .item-icon {
        font-size: 0.9rem;
      }
    }

    .telemetry-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-color, #fff);
      font-variant-numeric: tabular-nums;

      &.activity-tag {
        text-transform: capitalize;
      }

      &.accuracy-badge {
        font-size: 0.82rem;

        &.good {
          color: #81c784;
        }

        &.medium {
          color: #ffb74d;
        }

        &.poor {
          color: #e57373;
        }
      }
    }

    .font-mono {
      font-family: monospace;
      letter-spacing: 0.5px;
    }
  }
}

.sync-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));

  .sync-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--fg-secondary-color, rgba(255, 255, 255, 0.65));

    .sync-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;

      &.synced {
        background: #4caf50;
      }

      &.unsent {
        background: #ff9800;
      }
    }

    .sync-text {
      strong {
        color: var(--fg-color, #fff);
      }
    }

    .sync-time {
      opacity: 0.7;
    }
  }
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  flex-shrink: 0;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    background: var(--bg-hover-color, #444);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    border-radius: 26px;
    transition:
      background 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.25s;
    cursor: pointer;

    &::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      top: 3px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  input:checked + .slider {
    background: var(--primary, #4caf50);
    border-color: var(--primary, #4caf50);

    &::before {
      transform: translateX(22px);
    }
  }

  input:disabled + .slider {
    opacity: 0.5;
    cursor: not-allowed;
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

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
}
</style>
