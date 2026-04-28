<script setup lang="ts">
import type { DestinationReview } from '~/shared/types/models/destination-review'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const props = defineProps<{ review: DestinationReview }>()
const emit = defineEmits(['delete'])

const averageRating = computed(() => {
  const values = Object.values(props.review.metrics) as number[]
  if (!values.length)
    return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return (sum / values.length).toFixed(1)
})

const metricLabels: Record<string, string> = {
  infrastructure: 'Инфраструктура',
  nature: 'Природа',
  food: 'Еда',
  prices: 'Цены',
  vibe: 'Атмосфера',
}

const flagSrc = computed(() => props.review.country?.flagUrl || '')

const placeName = computed(() => {
  return props.review.type === 'city'
    ? `${props.review.city}, ${props.review.country?.name}`
    : props.review.country?.name
})

function getMetricColorClass(value: number) {
  if (value <= 2)
    return 'is-low'
  if (value === 3)
    return 'is-medium'
  return 'is-high'
}
</script>

<template>
  <div class="review-card">
    <div class="card-cover">
      <div v-if="review.coverUrl" class="cover-bg" :style="{ backgroundImage: `url(${review.coverUrl})` }" />
      <div v-else class="cover-placeholder">
        <Icon icon="mdi:image-off-outline" />
      </div>
      <div class="rating-badge">
        <Icon icon="mdi:star" class="star-icon" />
        <span>{{ averageRating }}</span>
      </div>
      <button class="delete-btn" title="Удалить" @click.stop="emit('delete', review.id)">
        <Icon icon="mdi:trash-can-outline" />
      </button>
    </div>

    <div class="card-body">
      <h3 class="title">
        <img v-if="flagSrc" :src="flagSrc" class="svg-flag" :alt="review.country?.name">
        <span>{{ placeName }}</span>
      </h3>

      <div class="metrics-list">
        <div v-for="(val, key) in review.metrics" :key="key" class="metric-item">
          <div class="metric-header">
            <span class="metric-name">{{ metricLabels[key] || key }}</span>
            <span class="metric-value">{{ val }}/5</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :class="getMetricColorClass(Number(val))" :style="{ width: `${(Number(val) / 5) * 100}%` }" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.review-card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-m);

    .delete-btn {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

.card-cover {
  position: relative;
  height: 140px;
  background: var(--bg-tertiary-color);
  overflow: hidden;

  .cover-bg {
    position: absolute;
    inset: 0;
    filter: blur(12px) brightness(0.85); /* Немного уменьшили размытие, чтобы атмосферный фон был яснее */
    transform: scale(1.15); /* Прячем резкие края после блюра */
    background-size: cover;
    background-position: center;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    color: var(--fg-tertiary-color);
    background:
      linear-gradient(45deg, var(--bg-tertiary-color) 25%, transparent 25%),
      linear-gradient(-45deg, var(--bg-tertiary-color) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--bg-tertiary-color) 75%),
      linear-gradient(-45deg, transparent 75%, var(--bg-tertiary-color) 75%);
    background-size: 20px 20px;
    background-position:
      0 0,
      0 10px,
      10px -10px,
      -10px 0;
  }

  .rating-badge {
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    color: #fff;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-weight: 700;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);

    .star-icon {
      color: #f5a623;
    }
  }

  .delete-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(var(--bg-error-color-rgb), 0.8);
    color: var(--fg-error-color);
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transform: translateY(-5px);
    transition:
      opacity 0.2s,
      transform 0.2s;

    &:hover {
      background: var(--bg-error-color);
    }
  }
}

.card-body {
  padding: 16px;

  .title {
    margin: 0 0 16px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .svg-flag {
    width: 24px;
    height: 16px;
    object-fit: cover;
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }
}

.metrics-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric-item {
  .metric-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    margin-bottom: 4px;
  }

  .progress-bar-bg {
    height: 6px;
    background: var(--bg-tertiary-color);
    border-radius: var(--r-full);
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: var(--r-full);
    transition:
      background-color 0.3s,
      width 0.5s;

    &.is-low {
      background: var(--fg-error-color);
    }
    &.is-medium {
      background: var(--fg-warning-color);
    }
    &.is-high {
      background: var(--fg-success-color);
    }
  }
}
</style>
