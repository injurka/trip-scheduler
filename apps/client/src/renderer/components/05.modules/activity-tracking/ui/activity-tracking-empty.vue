<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'

interface Props {
  /** Размер выбранного окна статистики (дней) — чтобы честно указать период */
  selectedDays?: number
  /** Сколько точек лежит в локальном буфере и ещё не на сервере */
  unsentCount?: number
  isTrackingRunning?: boolean
  isSyncing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedDays: 14,
  unsentCount: 0,
  isTrackingRunning: false,
  isSyncing: false,
})

const emit = defineEmits<{
  (e: 'sync'): void
  (e: 'openMemories'): void
}>()

const unsentText = computed(() => {
  const c = Math.abs(props.unsentCount) % 100
  const n = c % 10
  if (c > 10 && c < 20)
    return 'точек'
  if (n > 1 && n < 5)
    return 'точки'
  if (n === 1)
    return 'точка'
  return 'точек'
})
</script>

<template>
  <!--
    Вариант 1: точки записаны, но ещё не попали на сервер —
    статистика пуста именно поэтому, синхронизация решит проблему.
  -->
  <div v-if="props.unsentCount > 0" class="activity-empty-state is-pending">
    <div class="empty-icon-wrap">
      <Icon icon="mdi:cloud-upload-outline" class="empty-icon" />
    </div>
    <h3 class="empty-title">
      Точки ещё не на сервере
    </h3>
    <p class="empty-hint">
      В буфере устройства <strong>{{ props.unsentCount }}</strong> {{ unsentText }}.
      Отправьте их на сервер — и записанные дни появятся в статистике ниже.
    </p>
    <div class="empty-actions">
      <KitBtn
        variant="solid"
        size="sm"
        color="primary"
        :disabled="props.isSyncing"
        @click="emit('sync')"
      >
        <template #prepend>
          <Icon icon="mdi:sync" :class="{ 'spin-icon': props.isSyncing }" />
        </template>
        {{ props.isSyncing ? 'Отправка...' : 'Синхронизировать' }}
      </KitBtn>
    </div>
  </div>

  <!-- Вариант 2: на сервере за выбранное окно данных нет -->
  <div v-else class="activity-empty-state">
    <div class="empty-icon-wrap">
      <Icon icon="mdi:radar" class="empty-icon" />
    </div>
    <h3 class="empty-title">
      {{ props.selectedDays === 1 ? 'Записей за сегодня нет' : `Записей за ${props.selectedDays} дн. нет` }}
    </h3>
    <p class="empty-hint">
      <template v-if="props.isTrackingRunning">
        Трекинг включён: точки сохраняются в буфер и после синхронизации появятся
        в статистике и на карте воспоминаний.
      </template>
      <template v-else>
        Включите переключатель фонового GPS-трекинга выше — перемещения начнут
        автоматически сохраняться и отображаться на карте воспоминаний.
      </template>
      {{ props.selectedDays === 1 ? 'Статистика считается за сегодня.' : `Статистика считается только за выбранный период (${props.selectedDays} дн.).` }}
    </p>
    <div class="empty-actions">
      <KitBtn
        variant="tonal"
        size="sm"
        color="primary"
        @click="emit('openMemories')"
      >
        <template #prepend>
          <Icon icon="mdi:movie-open-play-outline" />
        </template>
        Открыть карту воспоминаний
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-empty-state {
  text-align: center;
  padding: var(--p-2xl) var(--p-m);
  color: var(--fg-secondary-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-s);
  background-color: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-l);

  &.is-pending {
    border-color: var(--border-warning-color);
  }

  .empty-icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: var(--r-full);
    background-color: var(--bg-accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-accent-color);

    .empty-icon {
      font-size: 2rem;
    }
  }

  .empty-title {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .empty-hint {
    max-width: 460px;
    font-size: 0.88rem;
    line-height: 1.45;
    margin: 0;

    strong {
      color: var(--fg-primary-color);
    }
  }

  .empty-actions {
    margin-top: var(--p-xs);
    display: flex;
    gap: var(--p-s);
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
</style>
