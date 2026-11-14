<script setup lang="ts">
import type { DayPoint, PointStatusBadge, SelectedPointInfo, TimezoneMode } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { MAX_PEDESTRIAN_SPEED_KMH } from '~/shared/services/tracking/track-processing'
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from '../models/types'

interface Props {
  readonly?: boolean
  selectedPoint: SelectedPointInfo | null
  timezoneMode: TimezoneMode
  formattedTime: string
  formattedEndTime?: string
  isCopied: boolean
  isDeleting: boolean
  statusBadge: PointStatusBadge | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'copy', point: DayPoint): void
  (e: 'delete', point: DayPoint): void
  (e: 'editActivity', point: DayPoint): void
  (e: 'close'): void
}>()

const expanded = ref(false)

const coordinates = computed(() => props.selectedPoint ? `${props.selectedPoint.point.lat.toFixed(5)}, ${props.selectedPoint.point.lng.toFixed(5)}` : '')
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
const conflictingSpeed = computed(() => pointActivity.value === 'walk' && (props.selectedPoint?.point?.speed ?? 0) * 3.6 > MAX_PEDESTRIAN_SPEED_KMH)
const speedFormatted = computed(() => {
  const sp = props.selectedPoint?.point?.speed

  if (sp == null)
    return '—'

  return `${(sp * 3.6).toFixed(1)} км/ч`
})

watch(() => props.selectedPoint?.point.clientPointId, () => {
  expanded.value = false
})
</script>

<template>
  <div class="memories-popup">
    <section v-if="selectedPoint" class="point-popup-card" aria-label="Выбранная GPS-точка">
      <header class="popup-head">
        <div class="activity-summary" :style="{ color: activityColor }">
          <Icon :icon="activityIcon" />
          <strong>{{ selectedPoint.point.stop && pointActivity === 'still' ? 'Остановка' : activityLabel }}</strong>
          <span v-if="selectedPoint.point.stop && stopDuration" class="stop-duration">{{ stopDuration }}</span>
          <Icon v-if="conflictingSpeed" icon="mdi:alert-circle-outline" title="Скорость GPS не согласуется с ходьбой. Откройте подробности." />
        </div>
        <button
          type="button"
          class="icon-btn close-btn"
          aria-label="Закрыть"
          title="Закрыть карточку"
          @click.stop="emit('close')"
        >
          <Icon icon="mdi:close" />
        </button>
      </header>
      <div class="popup-time-row">
        <span class="time-val"><Icon icon="mdi:clock-outline" />{{ formattedTime }}<template v-if="selectedPoint.point.stop"> – {{ formattedEndTime }}</template></span>
        <span :title="timezoneMode === 'track' ? 'Местное время записи' : 'Время устройства'" :aria-label="timezoneMode === 'track' ? 'Местное время записи' : 'Время устройства'"><Icon :icon="timezoneMode === 'track' ? 'mdi:earth' : 'mdi:cellphone'" /></span>
        <span class="popup-index">#{{ selectedPoint.index }} / {{ selectedPoint.total }}</span>
      </div>
      <dl class="primary-metrics">
        <div v-if="!selectedPoint.point.stop">
          <dt>Скорость GPS</dt><dd>{{ speedFormatted }}</dd>
        </div>
        <div v-else>
          <dt>Замеры</dt><dd>{{ selectedPoint.point.stop.samplesCount }}</dd>
        </div>
        <div>
          <dt>Точность GPS</dt><dd :class="{ warning: (selectedPoint.point.accuracy ?? 0) > 30 }">
            {{ selectedPoint.point.accuracy == null ? '—' : `≈ ${Math.round(selectedPoint.point.accuracy)} м` }}
          </dd>
        </div>
      </dl>
      <div class="popup-toolbar">
        <KitBtn
          v-if="!readonly"
          size="sm"
          variant="text"
          aria-label="Исправить движение"
          @click="emit('editActivity', selectedPoint.point)"
        >
          <Icon icon="mdi:pencil-outline" />Исправить
        </KitBtn>
        <button
          type="button"
          class="details-toggle"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Свернуть' : 'Подробнее' }}<Icon :icon="expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </button>
        <button
          type="button"
          class="icon-btn coords-card"
          :class="{ 'is-copied': isCopied }"
          :title="isCopied ? 'Скопировано' : coordinates"
          :aria-label="isCopied ? 'Координаты скопированы' : `Скопировать координаты: ${coordinates}`"
          @click.stop="emit('copy', selectedPoint.point)"
        >
          <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
        </button>
      </div>
      <div v-if="expanded" class="popup-details">
        <div class="activity-details">
          <span>{{ selectedPoint.point.activitySource === 'manual' ? 'Исправлено вручную' : 'Автоматически по участку' }}</span>
          <span v-if="pointActivity !== 'unknown' && selectedPoint.point.activitySource !== 'manual' && selectedPoint.point.activityConfidence != null" class="confidence" title="Эвристическая оценка классификации">Уверенность {{ Math.round(selectedPoint.point.activityConfidence * 100) }}%</span>
        </div>
        <p v-if="pointActivity === 'unknown'" class="classification-note">
          Недостаточно согласованных данных. Одна скорость GPS не определяет тип движения.
        </p>
        <p v-else-if="conflictingSpeed" class="classification-note">
          Скорость этой GPS-точки не согласуется с ходьбой. Возможен выброс скорости или переход между типами движения.
        </p>
        <dl class="secondary-metrics">
          <div v-if="selectedPoint.point.altitude != null">
            <dt>Высота</dt><dd>{{ Math.round(selectedPoint.point.altitude) }} м</dd>
          </div>
          <div v-if="selectedPoint.point.stop?.radiusM != null">
            <dt>Радиус остановки</dt><dd>≈ {{ Math.round(selectedPoint.point.stop.radiusM) }} м</dd>
          </div>
          <div v-else-if="selectedPoint.point.bearing != null && selectedPoint.point.bearing >= 0">
            <dt>Курс</dt><dd>{{ Math.round(selectedPoint.point.bearing) }}°</dd>
          </div>
        </dl>
        <span class="coordinates-value">{{ coordinates }}</span>
        <p v-if="statusBadge && statusBadge.type !== 'valid'" class="popup-validity-tag">
          <Icon :icon="statusBadge.icon" />{{ statusBadge.label }}
        </p>
        <KitBtn
          v-if="!readonly && !selectedPoint.point.stop"
          class="delete-btn"
          size="sm"
          variant="text"
          :disabled="isDeleting"
          aria-label="Удалить точку"
          @click.stop="emit('delete', selectedPoint.point)"
        >
          <Icon :icon="isDeleting ? 'mdi:loading' : 'mdi:trash-can-outline'" :class="{ spin: isDeleting }" />Удалить точку
        </KitBtn>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.point-popup-card {
  box-sizing: border-box;
  width: min(310px, calc(100vw - 24px));
  max-height: min(440px, var(--track-point-popup-height, 70dvh));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  background: var(--bg-secondary-color);
  box-shadow: var(--s-l);
  color: var(--fg-primary-color);
  font-size: 0.8rem;
  line-height: 1.4;
}
.popup-head,
.activity-summary,
.popup-time-row,
.time-val,
.popup-toolbar {
  display: flex;
  align-items: center;
}
.popup-head {
  position: sticky;
  top: -8px;
  z-index: 1;
  background: var(--bg-secondary-color);
  justify-content: space-between;
  gap: 8px;
}
.activity-summary {
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}
.activity-summary > svg {
  flex-shrink: 0;
  font-size: 18px;
}
.activity-summary strong {
  font-size: 0.9rem;
}
.stop-duration {
  font-size: 0.75rem;
  white-space: nowrap;
}
.icon-btn,
.details-toggle {
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font: inherit;
}
.icon-btn {
  width: 44px;
  flex: 0 0 44px;
  border-radius: 50%;
  font-size: 18px;
}
.icon-btn:hover,
.details-toggle:hover {
  background: var(--bg-hover-color);
}
.popup-time-row {
  gap: 6px;
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
}
.time-val {
  gap: 5px;
  white-space: nowrap;
  font-weight: 600;
  color: var(--fg-primary-color);
  font-variant-numeric: tabular-nums;
}
.popup-index {
  margin-left: auto;
  font-size: 0.65rem;
  white-space: nowrap;
}
.primary-metrics,
.secondary-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 10px 0 4px;
}
.primary-metrics > div {
  padding: 6px 8px;
  background: var(--bg-tertiary-color);
  border-radius: 10px;
}
dt {
  font-size: 0.68rem;
  color: var(--fg-secondary-color);
}
dd {
  margin: 2px 0 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.popup-toolbar {
  justify-content: space-between;
  gap: 2px;
}
.popup-toolbar :deep(.kit-btn) {
  min-height: 44px;
  padding: 0 6px;
  font-size: 0.75rem;
}
.details-toggle {
  padding: 0 6px;
  font-size: 0.75rem;
  border-radius: 8px;
}
.popup-details {
  border-top: 1px solid var(--border-secondary-color);
  padding: 10px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.activity-details {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.7rem;
  color: var(--fg-secondary-color);
}
.classification-note {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
}
.coordinates-value {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.popup-validity-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 0.7rem;
  color: var(--fg-secondary-color);
}
.warning,
.delete-btn {
  color: var(--fg-error-color, #c45148);
}
.is-copied {
  color: var(--fg-accent-color);
}
button:focus-visible {
  outline: 2px solid var(--fg-accent-color);
  outline-offset: -2px;
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
