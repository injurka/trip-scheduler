<script setup lang="ts">
import type { DestinationMetricKey } from '../../composables/use-destination-reviews'
import type { DestinationReview } from '~/shared/types/models/destination-review'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitMap } from '~/components/01.kit/kit-map'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { getImageUrl } from '~/shared/lib/url'
import { METRIC_LABELS } from '../../composables/use-destination-reviews'

const props = defineProps<{ review: DestinationReview, isOwner: boolean }>()
const emit = defineEmits(['delete', 'edit'])

const isExpanded = ref(false)

const METRIC_ICONS: Record<DestinationMetricKey, string> = {
  safety: 'mdi:shield-check-outline',
  culture: 'mdi:bank-outline',
  infrastructure: 'mdi:city-variant-outline',
  food: 'mdi:silverware-fork-knife',
  prices: 'mdi:wallet-outline',
  nature: 'mdi:pine-tree',
  vibe: 'mdi:emoticon-cool-outline',
  climate: 'mdi:weather-partly-cloudy',
  people: 'mdi:account-group-outline',
  entertainment: 'mdi:glass-cocktail',
}

const METRIC_DESCRIPTIONS: Record<DestinationMetricKey, string> = {
  safety: 'Уровень преступности, комфорт и общая безопасность на улицах.',
  culture: 'Историческое наследие, музеи, театры, архитектура и традиции.',
  infrastructure: 'Качество общественного транспорта, дорог, доступность городских сервисов.',
  food: 'Местная кухня, разнообразие и качество кафе, ресторанов и продуктов в магазинах.',
  prices: 'Общая стоимость жизни, аренды жилья, развлечений и еды.',
  nature: 'Экология, чистота воздуха, наличие парков, скверов и близость к природе.',
  vibe: 'Эстетика, ритм жизни, комфорт нахождения и общая уникальная атмосфера места.',
  climate: 'Погодные условия в течение года, сезонность и количество солнечных дней.',
  people: 'Приветливость местных жителей, уровень знания английского и открытость к приезжим.',
  entertainment: 'Ночная жизнь, бары, концерты, шопинг и разнообразие активного досуга.',
}

const numericMetrics = computed(() => {
  const res: Partial<Record<DestinationMetricKey, number>> = {}
  for (const [k, v] of Object.entries((props.review.metrics as Record<string, any>) || {})) {
    if (typeof v === 'number' && !k.endsWith('_comment')) {
      res[k as DestinationMetricKey] = v
    }
  }
  return res
})

const averageRating = computed(() => {
  const values = Object.values(numericMetrics.value)
  if (!values.length)
    return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return (sum / values.length).toFixed(1)
})

const metricComments = computed(() => {
  const comments: Partial<Record<DestinationMetricKey, string>> = {}
  for (const [key, value] of Object.entries((props.review.metrics as Record<string, any>) || {})) {
    if (key.endsWith('_comment')) {
      comments[key.replace('_comment', '') as DestinationMetricKey] = String(value)
    }
  }
  return comments
})

const ratingValue = computed(() => Number(averageRating.value))

const ratingLevelClass = computed(() => {
  if (ratingValue.value < 3)
    return 'wreath-poor'
  if (ratingValue.value < 4)
    return 'wreath-average'
  return 'wreath-excellent'
})

const flagSrc = computed(() => props.review.country?.flagUrl || '')
const placeName = computed(() => `${props.review.city}, ${props.review.country?.name}`)

const coverMediumUrl = computed(() => {
  const variants = (props.review as any).coverVariants as Record<string, string> | undefined
  let src = props.review.coverUrl
  if (variants?.medium) {
    src = variants.medium
  }
  return src ? (getImageUrl(src) || src) : ''
})

const mapCenter = computed<[number, number]>(() => [Number(props.review.longitude), Number(props.review.latitude)])
const mapMarkers = computed(() => [{
  id: 'review-pin',
  coords: { lat: Number(props.review.latitude), lon: Number(props.review.longitude) },
}])

function getMetricColorClass(value: number) {
  if (value <= 2)
    return 'color-low'
  if (value === 3)
    return 'color-medium'
  return 'color-high'
}

function openExpanded() {
  isExpanded.value = true
}
</script>

<template>
  <div>
    <!-- Мини-карточка (Превью) -->
    <div class="review-card" @click="openExpanded">
      <div class="card-bg">
        <KitImage v-if="review.coverUrl" :src="coverMediumUrl" class="bg-image" alt="Cover" />
        <div v-else class="bg-placeholder">
          <Icon icon="mdi:image-off-outline" />
        </div>
        <div class="bg-overlay" />
      </div>

      <div v-if="isOwner" class="card-actions" @click.stop>
        <KitTooltip name="Редактировать">
          <button class="action-btn" @click.stop="emit('edit', review)">
            <Icon icon="mdi:pencil-outline" />
          </button>
        </KitTooltip>

        <KitTooltip name="Удалить">
          <button class="action-btn danger" @click.stop="emit('delete', review.id)">
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </KitTooltip>
      </div>

      <!-- Боковая панель мини-метрик -->
      <div class="mini-metrics-column">
        <KitTooltip
          v-for="(val, key) in numericMetrics"
          :key="key"
          :name="`${METRIC_LABELS[key] || key}: ${val}/5`"
        >
          <div
            class="mini-metric-item"
            :class="getMetricColorClass(Number(val))"
          >
            <Icon :icon="METRIC_ICONS[key] || 'mdi:star'" />
          </div>
        </KitTooltip>
      </div>

      <div class="card-content">
        <div class="header-section">
          <!-- Центральный бейдж-оценка -->
          <div class="wreath-container" :class="ratingLevelClass">
            <div class="rating-number">
              {{ averageRating }}
            </div>
          </div>

          <h3 class="title">
            <img v-if="flagSrc" :src="flagSrc" class="svg-flag" :alt="review.country?.name">
            <span class="place-name">{{ placeName }}</span>
          </h3>
        </div>
      </div>
    </div>

    <!-- Развернутое модальное окно -->
    <KitDialogWithClose
      v-model:visible="isExpanded"
      :max-width="700"
    >
      <template #header>
        <div class="dialog-custom-title">
          <img v-if="flagSrc" :src="flagSrc" class="svg-flag lg" :alt="review.country?.name">
          <span>{{ placeName }}</span>
        </div>
      </template>

      <div class="dialog-content-layout">
        <!-- Обложка внутри диалога -->
        <div class="dialog-banner">
          <KitImage v-if="review.coverUrl" :src="review.coverUrl" class="banner-image" alt="Cover" />
          <div v-else class="banner-placeholder">
            <Icon icon="mdi:image-off-outline" />
          </div>
          <div class="banner-overlay">
            <div class="wreath-container large" :class="ratingLevelClass">
              <div class="rating-number">
                {{ averageRating }}
              </div>
            </div>
            <div class="banner-rating-text">
              Общая оценка
            </div>
          </div>
        </div>

        <!-- Секция: Оценки -->
        <div class="modal-section">
          <div class="section-header">
            <h3 class="section-title">
              <Icon icon="mdi:star-box-multiple-outline" />
              Оценки
            </h3>
            <div class="info-tooltip-wrapper">
              <Icon icon="mdi:information-outline" class="info-icon" />
              <div class="info-tooltip-content">
                <div v-for="(desc, k) in METRIC_DESCRIPTIONS" :key="k" class="tooltip-row">
                  <strong>{{ METRIC_LABELS[k] || k }}:</strong> {{ desc }}
                </div>
              </div>
            </div>
          </div>

          <div class="metrics-grid">
            <!-- Отображаем только числа, без комментариев в ключах -->
            <div v-for="(val, key) in numericMetrics" :key="key" class="metric-item">
              <div class="metric-header">
                <span class="metric-name">
                  <Icon :icon="METRIC_ICONS[key] || 'mdi:star'" class="metric-icon" />
                  {{ METRIC_LABELS[key] || key }}
                </span>
                <span class="metric-value">{{ val }}/5</span>
              </div>

              <div class="progress-bar-bg">
                <div
                  class="progress-bar-fill"
                  :class="getMetricColorClass(Number(val))"
                  :style="{ width: `${(Number(val) / 5) * 100}%` }"
                />
              </div>

              <!-- Показываем комментарий если он есть -->
              <div
                v-if="metricComments[key] && metricComments[key].trim() !== ''"
                class="metric-comment-box"
              >
                <Icon icon="mdi:format-quote-open" class="quote-icon" />
                <span class="comment-text">{{ metricComments[key] }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Секция: Описание -->
        <div v-if="review.content" class="modal-section">
          <div class="section-header">
            <h3 class="section-title">
              <Icon icon="mdi:text-box-outline" />
              Описание
            </h3>
          </div>
          <div class="review-text">
            <KitInlineMdEditorWrapper
              :model-value="review.content"
              readonly
            />
          </div>
        </div>

        <!-- Секция: Локация -->
        <div class="modal-section">
          <div class="section-header">
            <h3 class="section-title">
              <Icon icon="mdi:map-marker-radius-outline" />
              Локация
            </h3>
          </div>
          <div class="map-section">
            <KitMap
              :center="mapCenter"
              :zoom="12"
              height="400px"
              :markers="mapMarkers"
              :auto-pan="false"
            />
          </div>
        </div>
      </div>
    </KitDialogWithClose>
  </div>
</template>

<style scoped lang="scss">
.review-card {
  position: relative;
  border-radius: var(--r-l);
  overflow: hidden;
  min-height: 240px;
  cursor: pointer;
  box-shadow: var(--s-m);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-l);
    .card-actions {
      opacity: 1;
      transform: translateY(0);
    }
    .bg-image {
      transform: scale(1.05);
    }
  }
}

.card-bg {
  position: absolute;
  inset: 0;
  z-index: 1;

  .bg-image {
    width: 100%;
    height: 100%;
    transition: transform 0.5s ease;
  }
  .bg-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    color: rgba(255, 255, 255, 0.2);
    background: var(--bg-tertiary-color);
  }
  .bg-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.85) 100%);
  }
}

.card-actions {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  display: flex;
  gap: 8px;
  opacity: 0;
  transform: translateY(-5px);
  transition:
    opacity 0.2s,
    transform 0.2s;

  .action-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: background 0.2s;
    &:hover {
      background: rgba(0, 0, 0, 0.8);
    }
    &.danger:hover {
      background: var(--bg-error-color);
    }
  }
}

.mini-metrics-column {
  position: absolute;
  top: 0px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 5px;
  height: 240px;
  flex-wrap: wrap-reverse;
  justify-content: center;
}

.mini-metric-item {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: help;
  transition:
    transform 0.2s ease,
    background 0.2s ease;

  &.color-low {
    color: #ff4d4f;
  }
  &.color-medium {
    color: #d4a373;
  }
  &.color-high {
    color: #52c41a;
  }

  &:hover {
    transform: scale(1.15);
    background: rgba(0, 0, 0, 0.7);
    z-index: 100;
  }
}

.card-content {
  position: relative;
  z-index: 5;
  padding: 20px;
  color: white;
}

.header-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);

  .svg-flag {
    width: 26px;
    height: 18px;
    object-fit: cover;
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

.wreath-container {
  position: relative;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border: 2px solid currentColor;
  transition: all 0.3s ease;

  .rating-number {
    font-size: 1.1rem;
    font-weight: 800;
    z-index: 2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  &.large {
    width: 64px;
    height: 64px;
    border-width: 3px;
    .rating-number {
      font-size: 1.5rem;
    }
  }

  &.wreath-poor {
    color: #ff4d4f;
  }
  &.wreath-average {
    color: #d4a373;
  }
  &.wreath-excellent {
    color: #ffd700;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
  }
}

/* --- Стили для внутреннего диалога --- */
.dialog-custom-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--fg-primary-color);

  .svg-flag {
    width: 28px;
    height: 20px;
    object-fit: cover;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

.dialog-content-layout {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.dialog-banner {
  position: relative;
  width: 100%;
  height: 220px;
  border-radius: var(--r-m);
  overflow: hidden;
  flex-shrink: 0;

  .banner-image {
    width: 100%;
    height: 100%;
  }

  .banner-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 4rem;
    color: rgba(255, 255, 255, 0.2);
    background: var(--bg-tertiary-color);
  }

  .banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 40%, rgba(0, 0, 0, 0.85) 100%);
    display: flex;
    align-items: flex-end;
    padding: 20px;
  }

  .banner-rating-text {
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    margin-left: 16px;
    margin-bottom: 6px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border-secondary-color);
  padding-bottom: 10px;
}

.section-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  gap: 8px;

  .iconify {
    color: var(--fg-accent-color);
    font-size: 1.4rem;
  }
}

.info-tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  color: var(--fg-secondary-color);
  cursor: help;
  margin-left: 4px;
  margin-top: 2px;

  .info-icon {
    font-size: 1.1rem;
    transition: color 0.2s ease;
  }

  &:hover {
    .info-icon {
      color: var(--fg-primary-color);
    }
    .info-tooltip-content {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  }
}

.info-tooltip-content {
  position: absolute;
  top: calc(100% + 12px);
  left: -20px;
  width: 320px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-l);
  border-radius: var(--r-m);
  padding: 14px;
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-10px);
  transition: all 0.2s ease;

  .tooltip-row {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    margin-bottom: 8px;
    line-height: 1.4;
    &:last-child {
      margin-bottom: 0;
    }
    strong {
      color: var(--fg-primary-color);
      font-weight: 600;
    }
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px 20px;
}

.metric-item {
  display: flex;
  flex-direction: column;

  .metric-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--fg-primary-color);

    .metric-name {
      display: flex;
      align-items: center;
      gap: 8px;

      .metric-icon {
        color: var(--fg-secondary-color);
        font-size: 1.1rem;
      }
    }
  }

  .progress-bar-bg {
    height: 8px;
    background: var(--bg-tertiary-color);
    border-radius: var(--r-full);
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: var(--r-full);
    &.color-low {
      background: #ff4d4f;
    }
    &.color-medium {
      background: #d4a373;
    }
    &.color-high {
      background: #52c41a;
    }
  }

  .metric-comment-box {
    margin-top: 10px;
    background: var(--bg-secondary-color);
    border-left: 3px solid var(--fg-accent-color);
    border-radius: 0 var(--r-s) var(--r-s) 0;
    padding: 10px 12px;
    display: flex;
    gap: 10px;
    align-items: flex-start;

    .quote-icon {
      color: var(--fg-accent-color);
      font-size: 1.2rem;
      flex-shrink: 0;
      opacity: 0.8;
      margin-top: -2px;
    }

    .comment-text {
      font-size: 0.85rem;
      color: var(--fg-primary-color);
      font-style: italic;
      line-height: 1.4;
      margin: 0;
    }
  }
}

.map-section {
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
}

.review-text {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--fg-primary-color);
  background: var(--bg-secondary-color);
  padding: 16px 20px;
  border-radius: var(--r-m);
  border-left: 4px solid var(--fg-accent-color);

  :deep(.ProseMirror p) {
    font-size: 0.9rem;
    line-height: 1.5;
  }
}
</style>
