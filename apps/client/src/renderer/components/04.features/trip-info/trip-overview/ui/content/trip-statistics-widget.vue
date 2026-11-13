<script setup lang="ts">
import type { RouterOutput } from '~/shared/types/trpc'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { trpc } from '~/shared/services/trpc/trpc.service'

interface Props {
  tripId: string
  shareSlug?: string | null
  canEdit: boolean
  startDate: string
  endDate: string
}
const props = defineProps<Props>()

const data = ref<RouterOutput['trip']['getStatistics']>(null)
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
let request = 0
const modes = [
  { key: 'walk', label: 'Пешком', icon: 'mdi:walk', color: '#40a77b' },
  { key: 'bike', label: 'Велосипед', icon: 'mdi:bike', color: '#3c9aaf' },
  { key: 'vehicle', label: 'Автотранспорт', icon: 'mdi:car-outline', color: '#df7449' },
  { key: 'rail', label: 'Поезд', icon: 'mdi:train', color: '#9275ba' },
  { key: 'unknown', label: 'Не определено', icon: 'mdi:map-marker-question-outline', color: '#92918f' },
] as const

const totalM = computed(() => Object.values(data.value?.distanceM ?? {}).reduce((a, b) => a + b, 0))
const details = computed(() => data.value
  ? [
      { label: 'Кадры с оценкой 4–5', value: data.value.favoritePhotos, icon: 'mdi:star-outline' },
      { label: 'Текстовые воспоминания', value: data.value.textMemories, icon: 'mdi:text-box-outline' },
      { label: 'Заметки', value: data.value.notes, icon: 'mdi:notebook-outline' },
      { label: 'Документы', value: data.value.documents, icon: 'mdi:file-document-outline' },
      { label: 'Активности в плане', value: data.value.plannedActivities, icon: 'mdi:calendar-check-outline' },
      { label: 'Места в маршруте', value: data.value.plannedPlaces, icon: 'mdi:map-marker-outline' },
    ]
  : [])
const staleRange = computed(() => data.value && (data.value.startDate !== props.startDate || data.value.endDate !== props.endDate))

watch(() => [props.tripId, props.shareSlug], async () => {
  const current = ++request
  data.value = null
  error.value = ''
  loading.value = true
  refreshing.value = false

  try {
    const result = await trpc.trip.getStatistics.query({ tripId: props.tripId, shareSlug: props.shareSlug ?? undefined })

    if (current === request)
      data.value = result
  }
  catch {
    if (current === request)
      error.value = 'Не удалось загрузить статистику.'
  }
  finally {
    if (current === request)
      loading.value = false
  }
}, { immediate: true })

async function refresh() {
  if (!props.canEdit || refreshing.value)
    return

  const current = request
  refreshing.value = true
  error.value = ''

  try {
    const result = await trpc.trip.refreshStatistics.mutate({ tripId: props.tripId })

    if (current === request)
      data.value = result
  }
  catch (e) {
    if (current === request)
      error.value = e instanceof Error ? e.message : 'Не удалось обновить данные. Попробуйте ещё раз.'
  }
  finally {
    if (current === request)
      refreshing.value = false
  }
}
const number = (n: number) => n.toLocaleString('ru-RU')
const km = (m: number) => (m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
const share = (distance: number) => (totalM.value ? distance / totalM.value * 100 : 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
</script>

<template>
  <section class="trip-statistics" :aria-busy="loading || refreshing" aria-label="Путешествие в цифрах">
    <header>
      <div><span class="eyebrow">Коллекция впечатлений</span><h2>Путешествие в цифрах</h2></div>
      <KitBtn
        v-if="canEdit"
        variant="outlined"
        size="sm"
        icon="mdi:refresh"
        :disabled="loading || refreshing"
        @click="refresh"
      >
        {{ refreshing ? 'Считаем…' : 'Обновить данные' }}
      </KitBtn>
    </header>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
    <p v-if="loading" role="status">
      Загружаем сохранённые итоги…
    </p>
    <template v-else-if="data">
      <div class="highlights">
        <div><Icon icon="mdi:camera-outline" /><strong>{{ number(data.photos) }}</strong><span>фотографий в воспоминаниях</span></div>
        <div><Icon icon="mdi:map-marker-path" /><strong>{{ km(totalM) }} <small>км</small></strong><span>по записанным трекам</span></div>
        <div><Icon icon="mdi:movie-outline" /><strong>{{ number(data.videos) }}</strong><span>видеоисторий</span></div>
      </div>
      <div class="route-heading">
        <h3>Движение в поездке</h3>
        <span>Доля от общего расстояния</span>
      </div>
      <div class="route-stats">
        <div
          v-for="mode in modes"
          :key="mode.key"
          class="mode"
          :style="{ '--mode-color': mode.color }"
        >
          <div class="mode-label">
            <span class="mode-icon"><Icon :icon="mode.icon" /></span><span>{{ mode.label }}</span>
          </div>
          <strong>{{ km(data.distanceM[mode.key] ?? 0) }} <small>км</small></strong>
          <span class="mode-share">{{ share(data.distanceM[mode.key] ?? 0) }}% пути</span>
          <div class="bar" aria-hidden="true">
            <i :style="{ width: `${totalM ? (data.distanceM[mode.key] ?? 0) / totalM * 100 : 0}%`, background: mode.color }" />
          </div>
        </div>
      </div>
      <p v-if="!data.trackedDays" class="note">
        Пока нет загруженных GPS-треков за даты поездки. Нулевые расстояния не означают, что вы не двигались.
      </p>
      <div v-if="data.longestDay" class="achievement">
        <Icon icon="mdi:flag-checkered" />
        <div><span>Самый длинный маршрут дня</span><strong>{{ date(data.longestDay.date) }} · {{ km(data.longestDay.distanceM) }} км</strong></div>
      </div>
      <dl class="details">
        <div v-for="item in details" :key="item.label">
          <dt><Icon :icon="item.icon" />{{ item.label }}</dt><dd>{{ number(item.value) }}</dd>
        </div>
      </dl>
      <p class="note">
        Трек владельца · {{ data.trackedDays }} дн. с GPS · {{ (data.movingDurationMs / 3600000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) }} ч движения. Даты учитываются по UTC. Расстояния зависят от полноты и точности GPS.
      </p>
      <footer v-if="canEdit">
        <span>Обновлено {{ new Date(data.computedAt).toLocaleString('ru-RU') }}</span>
        <span>Пересчёт по кнопке · не чаще раза в минуту</span>
      </footer>
      <p v-if="canEdit && staleRange" class="note">
        Даты поездки изменились. Обновите данные, чтобы пересчитать итоги.
      </p>
    </template>
    <p v-else-if="!error" class="empty">
      Здесь соберётся история поездки: кадры, километры и маленькие достижения. {{ canEdit ? 'Нажмите «Обновить данные», чтобы собрать первые итоги.' : 'Участники ещё не рассчитали итоги путешествия.' }}
    </p>
  </section>
</template>

<style scoped lang="scss">
.trip-statistics {
  padding: clamp(18px, 4vw, 32px);
  border: 1px solid var(--border-color, #8883);
  border-radius: 24px;
  background: var(--bg-secondary-color, #8881);
  min-width: 0;
}
header,
footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}
h2 {
  margin: 5px 0 0;
  font-size: clamp(1.2rem, 3vw, 1.6rem);
}
.eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--fg-secondary-color);
}
.highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 28px 0;
}
.highlights > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, #df744917, #df744905);
}
.highlights strong {
  font-size: clamp(1.7rem, 4vw, 2.6rem);
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.highlights small {
  font-size: 0.85rem;
}
.highlights span,
.note,
footer,
.empty {
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--fg-secondary-color);
}
.route-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 12px;
}
.route-heading h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}
.route-heading > span {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
}
.route-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 16px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--mode-color) 14%, var(--bg-secondary-color));
  border: 1px solid color-mix(in srgb, var(--mode-color) 24%, transparent);
}
.mode-label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 0.8rem;
  line-height: 1.3;
}
.mode-icon {
  width: 30px;
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  height: 30px;
  border-radius: 10px;
  color: var(--mode-color);
  background: color-mix(in srgb, var(--mode-color) 14%, transparent);
}
.mode-label > span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.mode-icon svg {
  font-size: 18px;
}
.mode strong {
  margin-top: 2px;
  font-size: clamp(1.2rem, 2.5vw, 1.55rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.mode strong small {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}
.mode-share {
  font-size: 0.7rem;
  color: var(--fg-secondary-color);
}
.bar {
  background: color-mix(in srgb, var(--mode-color) 15%, transparent);
  height: 4px;
  border-radius: 8px;
  overflow: hidden;
  margin-top: auto;
}
.bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
}
.mode:last-child {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  .mode-label {
    grid-row: 1 / 3;
    flex-direction: row;
    align-items: center;
  }
  strong {
    font-size: 1.1rem;
    margin: 0;
  }
  .mode-share {
    text-align: right;
  }
  .bar {
    grid-column: 1 / -1;
    margin-top: 6px;
  }
}

.achievement {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  margin: 24px 0;
  background: #40a77b12;
  border-radius: 16px;
}
.achievement > svg {
  font-size: 28px;
  flex-shrink: 0;
}
.achievement span,
.achievement strong {
  display: block;
  line-height: 1.6;
}
.achievement span {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}
.details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
  margin-top: 24px;
}
.details > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #8882;
  padding: 12px 0;
}
dt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}
dt svg {
  flex-shrink: 0;
}
dd {
  margin: 0;
  font-weight: 600;
}
footer {
  padding-top: 16px;
  border-top: 1px solid #8882;
  font-size: 0.7rem;
  gap: 4px 16px;
}
.error {
  color: var(--fg-error-color, #c45148);
  font-size: 0.85rem;
}
@media (max-width: 900px) {
  .route-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 480px) {
  .highlights {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .highlights > div:first-child {
    grid-column: 1 / -1;
  }
  .highlights > div {
    padding: 14px;
  }
  .route-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mode {
    padding: 12px;
    gap: 8px;
  }
  .mode-label {
    font-size: 0.8rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .mode-icon {
    width: 26px;
    flex-basis: 26px;
    height: 26px;
    border-radius: 8px;
  }
  .details {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
