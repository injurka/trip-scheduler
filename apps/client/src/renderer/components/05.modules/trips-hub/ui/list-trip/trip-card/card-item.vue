<script setup lang="ts">
import type { ITrip } from '../../../models/types'
import type { UpdateTripInput } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { DropdownMenuItem } from 'reka-ui'
import { inject } from 'vue'
import { KitAnimatedTooltip } from '~/components/01.kit/kit-animated-tooltip'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { TripCommentsWidget } from '~/components/04.features/trip-info/trip-comments'
import { TripEditInfoDialog } from '~/components/04.features/trip-info/trip-edit-info-dialog'
import { CommentParentType } from '~/shared/types/models/comment'
import { TripsHubKey } from '../../../composables'

type Props = ITrip

const props = withDefaults(defineProps<Props>(), {
  participants: () => [],
  tags: () => [],
})

const router = useRouter()
const tripsHub = inject(TripsHubKey)
const confirm = useConfirm()
const isMoreMenuOpen = ref(false)
const isEditModalOpen = ref(false)

function goTo() {
  router.push(AppRoutePaths.Trip.Info(`${props.id}`))
}

async function handleDelete() {
  const isConfirmed = await confirm({
    title: 'Удалить путешествие?',
    description: 'Это действие необратимо. Все дни, планы и воспоминания, связанные с этим путешествием, будут удалены.',
    type: 'danger',
    confirmText: 'Удалить',
  })

  if (isConfirmed && tripsHub) {
    tripsHub.deleteTrip(props.id)
  }
}

function handleEdit() {
  isEditModalOpen.value = true
}

function handleSave(updatedData: UpdateTripInput) {
  if (tripsHub) {
    tripsHub.updateTripInList({ id: props.id, ...updatedData })
  }
}

const formattedDates = computed(() => {
  const start = new Date(props.startDate)
  const end = new Date(props.endDate)

  const formatter = new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
  })

  if (start.getFullYear() === end.getFullYear()) {
    return `${formatter.format(start)} - ${formatter.format(end)} ${start.getFullYear()}`
  }
  else {
    return `${formatter.format(start)} ${start.getFullYear()} - ${formatter.format(end)} ${end.getFullYear()}`
  }
})

// Информация о статусе
const statusInfo = computed(() => {
  switch (props.status) {
    case 'completed':
      return { text: 'Завершено', class: 'completed', icon: 'mdi:check-circle-outline' }
    case 'planned':
      return { text: 'Запланировано', class: 'planned', icon: 'mdi:calendar-check-outline' }
    default:
      return { text: 'Черновик', class: 'draft', icon: 'mdi:pencil-circle-outline' }
  }
})

// Форматирование бюджета
const formattedBudget = computed(() => {
  if (!props.budget || !props.currency)
    return null

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: props.currency,
    minimumFractionDigits: 0,
  }).format(props.budget)
})

// Иконка для приватности
const visibilityIcon = computed(() => {
  switch (props.visibility) {
    case 'public':
      return { icon: 'mdi:earth', title: 'Публичное путешествие' }
    case 'private':
      return { icon: 'mdi:account-multiple-outline', title: 'Доступно по ссылке' }
    default:
      return { icon: 'mdi:lock-outline', title: 'Приватное путешествие' }
  }
})
</script>

<template>
  <div class="travel-card-wrapper" :class="{ 'more-menu-open': isMoreMenuOpen }">
    <div class="travel-card" @click="goTo">
      <div class="card-image-container">
        <KitImage
          v-if="imageUrl"
          :src="imageUrl"
          :alt="title"
          class="card-image"
        />
        <div v-else class="card-no-image">
          <Icon icon="mdi:map-legend" />
        </div>
        <div class="image-overlay" />
        <div class="card-header" />

        <h3 class="card-title">
          {{ title }}
        </h3>

        <span class="card-visibility">
          <Icon :icon="visibilityIcon.icon" />
        </span>

        <div class="card-actions">
          <KitDropdown v-model:open="isMoreMenuOpen" align="end">
            <template #trigger>
              <button class="action-btn" title="Еще" @click.stop.prevent>
                <Icon icon="mdi:dots-vertical" />
              </button>
            </template>
            <DropdownMenuItem class="kit-dropdown-item" @click.stop="handleEdit">
              <Icon icon="mdi:pencil-outline" /><span>Редактировать</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="kit-dropdown-item is-destructive" @click.stop="handleDelete">
              <Icon icon="mdi:trash-can-outline" /><span>Удалить</span>
            </DropdownMenuItem>
          </KitDropdown>
        </div>
      </div>

      <div class="card-content">
        <div v-if="description" class="card-description">
          {{ description }}
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
          <div class="meta-item">
            <Icon icon="mdi:map-marker-outline" />
            <span>{{ cities.join(', ') }}</span>
          </div>
          <div v-if="formattedBudget" class="meta-item">
            <Icon icon="mdi:wallet-outline" />
            <span>{{ formattedBudget }}</span>
          </div>
        </div>

        <div class="card-footer">
          <div v-if="participants.length" class="card-participants">
            <KitAnimatedTooltip
              v-for="participant in participants"
              :key="participant.id"
              :name="participant.name"
              :offset="10"
              class="participant-wrapper"
            >
              <KitAvatar
                :name="participant.name"
                :src="participant.avatarUrl"
              />
            </KitAnimatedTooltip>

            <KitAvatar
              v-if="participants.length > 3"
              class="participant-avatar"
              is-more
            >
              +{{ participants.length - 3 }}
            </KitAvatar>
          </div>
          <div class="card-footer-right">
            <div v-if="tags?.length" class="card-tags">
              <span v-for="tag in tags.slice(0, 2)" :key="tag" class="tag">
                {{ tag }}
              </span>
            </div>
            <TripCommentsWidget
              :parent-id="id"
              :parent-type="CommentParentType.TRIP"
              @click.stop
            />
          </div>
        </div>
      </div>
    </div>

    <TripEditInfoDialog
      v-if="isEditModalOpen"
      v-model:visible="isEditModalOpen"
      :trip="props"
      @save="handleSave"
    />
  </div>
</template>

<style scoped lang="scss">
.travel-card-wrapper {
  padding: 8px;
  border-radius: var(--r-xl);
  transition: all 0.3s ease-in-out;

  &:hover {
    background-color: var(--bg-hover-color);
  }
}

.travel-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  box-shadow: var(--s-m);
  cursor: pointer;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  border: 1px solid transparent;

  .travel-card-wrapper:hover & {
    box-shadow: var(--s-xl);
    border-color: var(--border-primary-color);
  }
}

.card-image-container {
  position: relative;
  height: 200px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px 16px;
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
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

.travel-card-wrapper:hover .card-image :deep(.image) {
  transform: scale(1.05);
}

.card-no-image {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 56px;
  opacity: 0.5;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg-tertiary-color) 0%, transparent 80%);
  opacity: 0.7;
  z-index: 1;
}

.card-header {
  position: relative;
  display: flex;
  z-index: 2;
  min-height: 20px; // Резервируем место
}

.card-visibility {
  position: absolute;
  bottom: 12px;
  right: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 1.1rem;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full);
  backdrop-filter: blur(5px);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--bg-overlay-secondary-color);
  }
}

.card-title {
  position: relative;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--fg-secondary-color);
  margin: 0 40px 0 0;
  z-index: 2;
  line-height: 1.2;
}

.card-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  z-index: 3;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.3s ease;

  .travel-card-wrapper:hover &,
  .travel-card-wrapper.more-menu-open & {
    opacity: 1;
    transform: translateX(0);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    border: none;
    border-radius: var(--r-full);
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: all 0.2s ease;

    &:hover {
      background-color: var(--bg-hover-color);
      transform: scale(1.1);
      color: var(--fg-accent-color);
    }
  }
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

  .meta-item {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--fg-secondary-color);
    font-size: 0.9rem;

    .iconify {
      font-size: 1.25rem;
      color: var(--fg-tertiary-color);
      transition: color 0.2s;
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
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);
}

.card-participants {
  display: flex;
  margin-left: 16px;

  .participants-container {
    display: flex;
    padding-left: 16px;
  }

  .participant-wrapper {
    margin-left: -16px;
    transition: transform 0.2s ease;

    &:hover {
      transform: translateY(-4px);
      z-index: 10;
    }
  }

  .participant-avatar {
    margin-left: -8px;

    &:first-child {
      margin-left: 0;
    }
  }
}
.card-footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-tags {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;

  .tag {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    padding: 4px 10px;
    border-radius: var(--r-l);
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }
}
</style>
