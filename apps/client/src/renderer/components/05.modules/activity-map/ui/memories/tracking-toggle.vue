<script setup lang="ts">
// Тумблер фонового GPS-трекинга + статус синхронизации.
// Виден только в мобильной Tauri-сборке (плагин geotrack).
// При выключении — предупреждение: маршрут подвижности пропадёт из воспоминаний дня.
import { useToast } from '~/shared/composables/use-toast'
import { useTrackingStore } from '~/shared/store/tracking.store'

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
      toast.success('Фоновый трекинг включён — маршруты будут записываться.')
    }
    else {
      toast.warn('Трекинг выключен: в воспоминаниях дня не будет маршрута подвижности.')
    }
    emit('changed', enable)
  }
  catch {
    // откат чекбокса при ошибке нативного вызова
    target.checked = tracking.isRunning
    toast.error('Не удалось изменить статус трекинга.')
  }
}
</script>

<template>
  <div v-if="tracking.canToggle" class="tracking-toggle">
    <div class="tracking-row">
      <div class="tracking-info">
        <span class="tracking-title">Фоновый трекинг</span>
        <span class="tracking-subtitle">
          <template v-if="tracking.isRunning">
            Запись маршрута активна
            <template v-if="tracking.unsentCount > 0">
              · {{ tracking.unsentCount }} точек в буфере
            </template>
          </template>
          <template v-else-if="tracking.lastError">
            {{ tracking.lastError }}
          </template>
          <template v-else>
            Выключен
          </template>
        </span>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          :checked="tracking.isRunning"
          :disabled="tracking.isStarting"
          @change="onToggle"
        >
        <span class="slider" />
      </label>
    </div>
    <span v-if="tracking.lastSyncAt" class="tracking-sync">
      Синхронизировано: {{ new Date(tracking.lastSyncAt).toLocaleTimeString('ru-RU') }}
    </span>
  </div>
</template>

<style scoped lang="scss">
.tracking-toggle {
  padding: 12px 16px;
  border: 1px solid var(--border-color, #333);
  border-radius: var(--r-m, 12px);

  .tracking-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .tracking-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tracking-title {
    font-weight: 600;
  }

  .tracking-subtitle {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .tracking-sync {
    display: block;
    margin-top: 6px;
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;

    input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      inset: 0;
      background: #555;
      border-radius: 24px;
      transition: background 0.2s;

      &::before {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        left: 3px;
        top: 3px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
      }
    }

    input:checked + .slider {
      background: var(--primary, #4caf50);

      &::before {
        transform: translateX(20px);
      }
    }
  }
}
</style>
