<script setup lang="ts">
import type { Trip } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { KitAnimatedTooltip } from '~/components/01.kit/kit-animated-tooltip'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitImage } from '~/components/01.kit/kit-image'
import { AppRoutePaths } from '~/shared/constants/routes'

const props = defineProps<{
  trip: Trip
}>()

const router = useRouter()

function goTo() {
  router.push(AppRoutePaths.Trip.Info(props.trip.id))
}

function navigateToProfile(userId: string) {
  router.push(AppRoutePaths.User.Profile(userId))
}

const formattedDates = computed(() => {
  const start = new Date(props.trip.startDate)
  const end = new Date(props.trip.endDate)
  const formatter = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' })

  if (start.getFullYear() === end.getFullYear()) {
    return `${formatter.format(start)} - ${formatter.format(end)} ${start.getFullYear()}`
  }
  return `${formatter.format(start)} ${start.getFullYear()} - ${formatter.format(end)} ${end.getFullYear()}`
})

const statusInfo = computed(() => {
  switch (props.trip.status) {
    case 'completed':
      return { text: 'Завершено', class: 'completed', icon: 'mdi:check-circle-outline' }
    case 'planned':
      return { text: 'Запланировано', class: 'planned', icon: 'mdi:calendar-check-outline' }
    default:
      return { text: 'Черновик', class: 'draft', icon: 'mdi:pencil-circle-outline' }
  }
})

const formattedBudget = computed(() => {
  if (!props.trip.budget || !props.trip.currency)
    return null
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: props.trip.currency,
    minimumFractionDigits: 0,
  }).format(props.trip.budget)
})
</script>

<template>
  <div class="travel-card-wrapper">
    <div class="travel-card" @click="goTo">
      <div class="card-image-container">
        <KitImage v-if="trip.imageUrl" :src="trip.imageUrl" :alt="trip.title" class="card-image" />
        <div v-else class="card-no-image">
          <Icon icon="mdi:map-legend" />
        </div>
        <div class="image-overlay" />
        <h3 class="card-title">
          {{ trip.title }}
        </h3>
      </div>

      <div class="card-content">
        <div v-if="trip.descriptionShort" class="card-description">
          {{ trip.descriptionShort }}
        </div>

        <div class="card-meta">
          <div class="meta-item meta-item--status" :class="statusInfo.class">
            <Icon :icon="statusInfo.icon" />
            <span>{{ statusInfo.text }}</span>
          </div>
          <div class="meta-item">
            <Icon icon="mdi:calendar-month-outline" />
            <span>{{ formattedDates }}</span>
          </div>
          <div v-if="trip.cities?.length" class="meta-item">
            <Icon icon="mdi:map-marker-outline" />
            <span>{{ trip.cities.join(', ') }}</span>
          </div>
          <div v-if="formattedBudget" class="meta-item">
            <Icon icon="mdi:wallet-outline" />
            <span>{{ formattedBudget }}</span>
          </div>
        </div>

        <div class="card-footer">
          <div class="card-participants">
            <div v-if="trip.participants?.length" class="participants-list">
              <KitAnimatedTooltip
                v-for="participant in trip.participants"
                :key="participant.id"
                :name="participant.name"
                :offset="10"
                class="participant-wrapper"
              >
                <KitAvatar
                  :name="participant.name"
                  :src="participant.avatarUrl"
                  class="clickable-avatar"
                  @click.stop="navigateToProfile(participant.id)"
                />
              </KitAnimatedTooltip>
            </div>
            <div v-else class="no-participants">
              <Icon icon="mdi:account-outline" />
              <span>Нет участников</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.travel-card-wrapper {
  padding: 0;
  border-radius: var(--r-xl);
  transition: all 0.3s ease-in-out;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.travel-card {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  box-shadow: var(--s-m);
  cursor: pointer;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  border: 1px solid transparent;

  @include hover {
    & {
      box-shadow: var(--s-xl);
      border-color: var(--border-primary-color);
      transform: translateY(-4px);
    }
  }
}

.card-image-container {
  position: relative;
  height: 200px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 12px 14px;
  box-sizing: border-box;
  border-radius: var(--r-l);
  overflow: hidden;

  .card-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .card-image :deep(.image) {
    transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

@media (hover: hover) and (pointer: fine) {
  .travel-card-wrapper:hover .card-image :deep(.image) {
    transform: scale(1.06);
  }
}

.card-no-image {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 40%, var(--bg-secondary-color) 0%, var(--bg-tertiary-color) 100%);
  color: var(--fg-secondary-color);
  font-size: 56px;
  opacity: 0.6;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.38) 0%, rgba(0, 0, 0, 0.06) 35%, transparent 55%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0.12) 75%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}

.card-title {
  position: relative;
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: #ffffff;
  margin: 0;
  z-index: 2;
  word-break: break-word;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.65);
}

.card-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-grow: 1;
  position: relative;
}

.card-description {
  color: var(--fg-secondary-color);
  padding-bottom: 4px;
  font-size: 0.9rem;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--fg-secondary-color);
    font-size: 0.9rem;

    .iconify {
      font-size: 1.25rem;
      color: var(--fg-tertiary-color);
    }

    &--status {
      font-weight: 500;

      &.completed {
        color: var(--fg-success-color);
        .iconify {
          color: var(--fg-success-color);
        }
      }
      &.planned {
        color: var(--fg-warning-color);
        .iconify {
          color: var(--fg-warning-color);
        }
      }
      &.draft {
        color: var(--fg-tertiary-color);
        .iconify {
          color: var(--fg-tertiary-color);
        }
      }
    }
  }
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);
}

.card-participants {
  display: flex;
  align-items: center;

  .participants-list {
    display: flex;
    padding-left: 8px;
  }

  .participant-wrapper {
    margin-left: -8px;
    transition: transform 0.2s ease;
    @include hover {
      & {
        transform: translateY(-4px);
        z-index: 10;
      }
    }
  }

  .clickable-avatar {
    cursor: pointer;
    transition: transform 0.2s ease;
    @include hover {
      & {
        transform: scale(1.1);
        z-index: 20;
      }
    }
  }

  .no-participants {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--fg-tertiary-color);
  }
}
</style>
