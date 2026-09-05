<script setup lang="ts">
import type { ActivityType } from '../models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useToast } from '~/shared/composables/use-toast'
import { useTrackingStore } from '~/shared/store/tracking.store'
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from '../models/constants'

const emit = defineEmits<{
  (e: 'changed', running: boolean): void
}>()

const tracking = useTrackingStore()
const toast = useToast()

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
      toast.info('Трекинг приостановлен: точки сохранены и синхронизируются.')
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

async function handleRequestPermission() {
  const granted = await tracking.requestPermission()
  if (granted) {
    toast.success('Доступ к геолокации предоставлен, трекинг запущен!')
    emit('changed', true)
  }
  else {
    toast.error(tracking.lastError || 'Не удалось получить доступ к геолокации.')
  }
}

function formatSyncTime(ts: number | null): string {
  if (!ts)
    return ''
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div v-if="tracking.canToggle" class="tracking-control-card">
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
                <Icon icon="mdi:loading" class="spin-icon" />
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
        <label class="tracking-switch" :title="tracking.isRunning ? 'Выключить трекинг' : 'Включить трекинг'">
          <input
            type="checkbox"
            :checked="tracking.isRunning"
            :disabled="tracking.isStarting"
            aria-label="Включить или выключить фоновый трекинг"
            @change="onToggle"
          >
          <span class="switch-slider" />
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
        <div v-if="tracking.hasPermissionDenied" class="error-actions">
          <KitBtn
            variant="outlined"
            size="xs"
            color="primary"
            class="permission-request-btn"
            @click="handleRequestPermission"
          >
            Запросить доступ
          </KitBtn>
        </div>
      </div>
      <button class="clear-error-btn" aria-label="Скрыть ошибку" @click="tracking.clearError">
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
            <Icon
              :icon="ACTIVITY_ICONS[tracking.telemetry.activity as ActivityType] || 'mdi:help-circle-outline'"
              class="item-icon"
              :style="{ color: ACTIVITY_COLORS[tracking.telemetry.activity as ActivityType] }"
            />
            Активность
          </span>
          <span
            class="telemetry-value activity-tag"
            :style="{ color: ACTIVITY_COLORS[tracking.telemetry.activity as ActivityType] }"
          >
            {{ ACTIVITY_LABELS[tracking.telemetry.activity as ActivityType] || 'Определение...' }}
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
        :disabled="tracking.isSyncing || tracking.unsentCount === 0"
        @click="handleManualSync"
      >
        <template #prepend>
          <Icon icon="mdi:sync" :class="{ 'spin-icon': tracking.isSyncing }" />
        </template>
        {{ tracking.isSyncing ? 'Отправка...' : 'Синхронизировать' }}
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tracking-control-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: var(--p-m);
  display: flex;
  flex-direction: column;
  gap: var(--p-m);
  box-shadow: var(--s-xs);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.tracking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-m);

  @include media-down(sm) {
    gap: var(--p-s);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--p-s);
  }

  .icon-avatar {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: var(--r-m);
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    transition: all 0.3s ease;
    flex-shrink: 0;

    .gps-icon {
      font-size: 1.4rem;
    }

    &.is-active {
      background-color: var(--bg-success-color);
      border-color: var(--border-success-color);
      color: var(--fg-success-color);

      .live-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 10px;
        height: 10px;
        border-radius: var(--r-full);
        background-color: var(--fg-success-color);
        border: 2px solid var(--bg-secondary-color);
        animation: pulse-ring 1.6s infinite;
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
      gap: 8px;
      flex-wrap: wrap;
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .card-subtitle {
      font-size: 0.82rem;
      color: var(--fg-secondary-color);
      line-height: 1.3;
    }
  }
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  font-size: 0.72rem;
  font-weight: 600;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  &.is-running {
    background-color: var(--bg-success-color);
    color: var(--fg-success-color);
    border-color: var(--border-success-color);

    .pulse-indicator {
      width: 6px;
      height: 6px;
      border-radius: var(--r-full);
      background-color: var(--fg-success-color);
      animation: pulse-ring 1.5s infinite;
    }
  }

  &.is-starting {
    background-color: var(--bg-warning-color);
    color: var(--fg-warning-color);
    border-color: var(--border-warning-color);
  }

  &.is-error {
    background-color: var(--bg-error-color);
    color: var(--fg-error-color);
    border-color: var(--border-error-color);
  }
}

.tracking-switch {
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

  .switch-slider {
    position: absolute;
    inset: 0;
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-primary-color);
    border-radius: var(--r-full);
    transition:
      background-color 0.25s ease,
      border-color 0.25s ease;
    cursor: pointer;

    &::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      top: 3px;
      background-color: var(--fg-primary-color);
      border-radius: var(--r-full);
      box-shadow: var(--s-xs);
      transition:
        transform 0.25s ease,
        background-color 0.25s ease;
    }
  }

  input:checked + .switch-slider {
    background-color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);

    &::before {
      transform: translateX(22px);
      background-color: var(--fg-inverted-color);
    }
  }

  input:disabled + .switch-slider {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.error-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--p-s);
  padding: var(--p-s) var(--p-m);
  background-color: var(--bg-error-color);
  border: 1px solid var(--border-error-color);
  border-radius: var(--r-m);
  color: var(--fg-error-color);

  .error-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .error-text {
    flex: 1;
    font-size: 0.8rem;

    .error-title {
      font-weight: 600;
      margin-bottom: 2px;
    }

    .error-desc {
      opacity: 0.9;
      line-height: 1.35;
    }

    .error-actions {
      margin-top: 8px;
    }
  }

  .clear-error-btn {
    background: transparent;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    padding: 2px;
    border-radius: var(--r-2xs);

    &:hover {
      opacity: 1;
    }
  }
}

.telemetry-panel {
  padding: var(--p-s);
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);

  .telemetry-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: var(--p-s);
  }

  .telemetry-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 6px;

    .telemetry-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      color: var(--fg-secondary-color);

      .item-icon {
        font-size: 0.9rem;
      }
    }

    .telemetry-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      font-variant-numeric: tabular-nums;

      &.activity-tag {
        text-transform: capitalize;
      }

      &.accuracy-badge {
        font-size: 0.82rem;

        &.good {
          color: var(--fg-success-color);
        }

        &.medium {
          color: var(--fg-warning-color);
        }

        &.poor {
          color: var(--fg-error-color);
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
  gap: var(--p-s);
  padding-top: var(--p-2xs);
  border-top: 1px solid var(--border-secondary-color);

  .sync-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--fg-secondary-color);

    .sync-dot {
      width: 7px;
      height: 7px;
      border-radius: var(--r-full);

      &.synced {
        background-color: var(--fg-success-color);
      }

      &.unsent {
        background-color: var(--fg-warning-color);
      }
    }

    .sync-text {
      strong {
        color: var(--fg-primary-color);
      }
    }

    .sync-time {
      opacity: 0.7;
    }
  }
}

.spin-icon {
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

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--fg-success-color-rgb), 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(var(--fg-success-color-rgb), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--fg-success-color-rgb), 0);
  }
}
</style>
