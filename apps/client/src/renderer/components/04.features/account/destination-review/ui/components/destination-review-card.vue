<script setup lang="ts">
import type { DestinationReview } from '~/shared/types/models/destination-review'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { METRIC_LABELS } from '../../composables/use-destination-reviews'

const props = defineProps<{ review: DestinationReview, isOwner: boolean }>()
const emit = defineEmits(['delete', 'edit'])

const isExpanded = ref(false)

const averageRating = computed(() => {
  const values = Object.values(props.review.metrics) as number[]
  if (!values.length) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return (sum / values.length).toFixed(1)
})

const ratingValue = computed(() => Number(averageRating.value))

const ratingLevelClass = computed(() => {
  if (ratingValue.value < 3) return 'wreath-poor'
  if (ratingValue.value < 4) return 'wreath-average'
  return 'wreath-excellent'
})

const metricComments = computed(() => (props.review as any).metricComments || {})

const flagSrc = computed(() => props.review.country?.flagUrl || '')
const placeName = computed(() => `${props.review.city}, ${props.review.country?.name}`)

function getMetricColorClass(value: number) {
  if (value <= 2) return 'is-low'
  if (value === 3) return 'is-medium'
  return 'is-high'
}

function openExpanded() {
  isExpanded.value = true
}

function closeExpanded() {
  isExpanded.value = false
}

watch(isExpanded, (val) => {
  if (val) document.body.style.overflow = 'hidden'
  else document.body.style.overflow = ''
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <div>
    <!-- Мини-карточка (Превью) -->
    <div class="review-card" @click="openExpanded">
      <div class="card-bg">
        <img v-if="review.coverUrl" :src="review.coverUrl" class="bg-image" alt="Cover">
        <div v-else class="bg-placeholder">
          <Icon icon="mdi:image-off-outline" />
        </div>
        <div class="bg-overlay" />
      </div>

      <div v-if="isOwner" class="card-actions" @click.stop>
        <button class="action-btn" title="Редактировать" @click.stop="emit('edit', review)">
          <Icon icon="mdi:pencil-outline" />
        </button>
        <button class="action-btn danger" title="Удалить" @click.stop="emit('delete', review.id)">
          <Icon icon="mdi:trash-can-outline" />
        </button>
      </div>

      <div class="card-content">
        <div class="header-section">
          <!-- Центральный венок-оценка -->
          <div class="wreath-container" :class="ratingLevelClass">
            <div class="rating-number">{{ averageRating }}</div>
            <Icon icon="mdi:leaf" class="leaf l1 left" />
            <Icon icon="mdi:leaf" class="leaf l1 right" />
            <Icon v-if="ratingValue >= 3" icon="mdi:leaf" class="leaf l2 left" />
            <Icon v-if="ratingValue >= 3" icon="mdi:leaf" class="leaf l2 right" />
            <Icon v-if="ratingValue >= 4" icon="mdi:leaf" class="leaf l3 left" />
            <Icon v-if="ratingValue >= 4" icon="mdi:leaf" class="leaf l3 right" />
          </div>
          
          <h3 class="title">
            <img v-if="flagSrc" :src="flagSrc" class="svg-flag" :alt="review.country?.name">
            <span class="place-name">{{ placeName }}</span>
          </h3>
        </div>
      </div>
    </div>

    <!-- Развернутое модальное окно -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="isExpanded" class="expanded-modal-overlay" @click.self="closeExpanded">
          <div class="expanded-modal-content">
            <button class="close-btn" @click="closeExpanded">
              <Icon icon="mdi:close" />
            </button>
            
            <div class="modal-cover">
              <img v-if="review.coverUrl" :src="review.coverUrl" class="modal-bg-image" alt="Cover">
              <div class="modal-header-content">
                <div class="wreath-container large" :class="ratingLevelClass">
                  <div class="rating-number">{{ averageRating }}</div>
                  <Icon icon="mdi:leaf" class="leaf l1 left" />
                  <Icon icon="mdi:leaf" class="leaf l1 right" />
                  <Icon v-if="ratingValue >= 3" icon="mdi:leaf" class="leaf l2 left" />
                  <Icon v-if="ratingValue >= 3" icon="mdi:leaf" class="leaf l2 right" />
                  <Icon v-if="ratingValue >= 4" icon="mdi:leaf" class="leaf l3 left" />
                  <Icon v-if="ratingValue >= 4" icon="mdi:leaf" class="leaf l3 right" />
                </div>
                <h2 class="modal-title">
                  <img v-if="flagSrc" :src="flagSrc" class="svg-flag lg" :alt="review.country?.name">
                  {{ placeName }}
                </h2>
              </div>
            </div>

            <div class="modal-body">
              <div class="metrics-grid">
                <div v-for="(val, key) in review.metrics" :key="key" class="metric-item">
                  <div class="metric-header">
                    <span class="metric-name">{{ METRIC_LABELS[key] || key }}</span>
                    <span class="metric-value">{{ val }}/5</span>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" :class="getMetricColorClass(Number(val))" :style="{ width: `${(Number(val) / 5) * 100}%` }" />
                  </div>
                  <p v-if="metricComments[key]" class="metric-comment">"{{ metricComments[key] }}"</p>
                </div>
              </div>

              <div v-if="review.content" class="review-text">
                {{ review.content }}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
/* -- Базовая карточка -- */
.review-card {
  position: relative;
  border-radius: var(--r-l);
  overflow: hidden;
  min-height: 220px;
  cursor: pointer;
  box-shadow: var(--s-m);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-l);
    .card-actions { opacity: 1; transform: translateY(0); }
    .bg-image { transform: scale(1.05); }
  }
}

.card-bg {
  position: absolute;
  inset: 0;
  z-index: 1;

  .bg-image { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
  .bg-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: rgba(255, 255, 255, 0.2); background: var(--bg-tertiary-color); }
  .bg-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%); }
}

.card-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
  opacity: 0;
  transform: translateY(-5px);
  transition: opacity 0.2s, transform 0.2s;

  .action-btn {
    width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);
    background: rgba(0,0,0,0.6); color: white; display: flex; align-items: center; justify-content: center;
    cursor: pointer; backdrop-filter: blur(4px); transition: background 0.2s;
    &:hover { background: rgba(0,0,0,0.8); }
    &.danger:hover { background: var(--bg-error-color); }
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
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);

  .svg-flag { width: 26px; height: 18px; object-fit: cover; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
}

/* -- ВЕНОК (ОЦЕНКА) -- */
.wreath-container {
  position: relative;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;

  .rating-number {
    font-size: 1.1rem;
    font-weight: 800;
    z-index: 2;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  }

  .leaf {
    position: absolute;
    font-size: 1rem;
    z-index: 1;

    &.left { transform-origin: right bottom; left: -2px; }
    &.right { transform-origin: right bottom; right: 12px; }

    /* Positions for a perfect circular laurel */
    &.l1.left { bottom: 4px; left: 10px; transform: scaleX(-1) rotate(-20deg); }
    &.l1.right { bottom: 4px; right: 10px; transform: rotate(-20deg); }
    
    &.l2.left { top: 18px; left: 4px; transform: scaleX(-1) rotate(-50deg); }
    &.l2.right { top: 18px; right: 4px; transform: rotate(-50deg); }
    
    &.l3.left { top: -2px; left: 16px; transform: scaleX(-1) rotate(-85deg); }
    &.l3.right { top: -2px; right: 16px; transform: rotate(-85deg); }
  }

  &.large {
    width: 80px; height: 80px;
    .rating-number { font-size: 1.8rem; }
    .leaf { font-size: 1.5rem; }
    .l1.left { bottom: 6px; left: 16px; }
    .l1.right { bottom: 6px; right: 16px; }
    .l2.left { top: 28px; left: 6px; }
    .l2.right { top: 28px; right: 6px; }
    .l3.left { top: -4px; left: 24px; }
    .l3.right { top: -4px; right: 24px; }
  }

  /* Цветовые палитры */
  &.wreath-poor { color: #ff4d4f; .leaf { opacity: 0.7; } }
  &.wreath-average { color: #d4a373; /* Бронза */ }
  &.wreath-excellent { color: #ffd700; filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.4)); }
}

/* -- МОДАЛЬНОЕ ОКНО -- */
.expanded-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.expanded-modal-content {
  background: var(--bg-primary-color);
  border-radius: var(--r-l);
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
}

.close-btn {
  position: absolute;
  top: 16px; right: 16px;
  background: rgba(0,0,0,0.5);
  color: white; border: none; border-radius: 50%;
  width: 36px; height: 36px; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem; cursor: pointer; transition: background 0.2s;
  &:hover { background: rgba(0,0,0,0.8); }
}

.modal-cover {
  position: relative;
  height: 280px;
  background: var(--bg-tertiary-color);
  flex-shrink: 0;
}

.modal-bg-image {
  width: 100%; height: 100%; object-fit: cover;
}

.modal-header-content {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.9) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px;
  color: white;
  gap: 12px;
}

.modal-title {
  margin: 0; font-size: 2rem; font-weight: 700; display: flex; align-items: center; gap: 12px;
  .svg-flag.lg { width: 36px; height: 26px; border-radius: 4px; }
}

.modal-body {
  padding: 32px 24px;
  display: flex; flex-direction: column; gap: 24px;
}

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }

.metric-item {
  .metric-header { display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600; margin-bottom: 8px; color: var(--fg-primary-color); }
  .progress-bar-bg { height: 8px; background: var(--bg-tertiary-color); border-radius: var(--r-full); overflow: hidden; }
  .progress-bar-fill { height: 100%; border-radius: var(--r-full); 
    &.is-low { background: var(--fg-error-color); }
    &.is-medium { background: var(--fg-warning-color); }
    &.is-high { background: var(--fg-success-color); }
  }
  .metric-comment { margin: 8px 0 0; font-size: 0.9rem; color: var(--fg-secondary-color); font-style: italic; line-height: 1.4; }
}

.review-text {
  font-size: 1.05rem; line-height: 1.7; color: var(--fg-primary-color);
  background: var(--bg-secondary-color); padding: 20px;
  border-radius: var(--r-m); border-left: 4px solid var(--fg-accent-color);
}

/* Анимация модального окна */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s ease;
  .expanded-modal-content { transition: transform 0.3s ease, opacity 0.3s ease; }
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
  .expanded-modal-content { transform: scale(0.95) translateY(20px); opacity: 0; }
}
</style>
