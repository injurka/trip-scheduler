<script setup lang="ts">
import type { ITrip } from '../../../models/types'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { Trip, TripSection, UpdateTripInput } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitAnimatedTooltip } from '~/components/01.kit/kit-animated-tooltip'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { TripCommentsWidget } from '~/components/04.features/trip-info/trip-comments'
import { TripEditInfoDialog } from '~/components/04.features/trip-info/trip-edit-info-dialog'
import { AppRoutePaths } from '~/shared/constants/routes'
import { CommentParentType } from '~/shared/types/models/comment'
import { TripsHubKey } from '../../../composables'

interface Props extends Omit<ITrip, 'userId' | 'sections' | 'createdAt' | 'updatedAt'> {
  userId?: string
  sections?: TripSection[]
  createdAt?: string
  updatedAt?: string
  isHighlight?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  participants: () => [],
  tags: () => [],
  isHighlight: false,
})

const router = useRouter()
const tripsHub = inject(TripsHubKey)
const confirm = useConfirm()
const isMoreMenuOpen = ref(false)
const isEditModalOpen = ref(false)

function goTo() {
  router.push(AppRoutePaths.Trip.Info(`${props.id}`))
}

function navigateToProfile(userId: string) {
  router.push(AppRoutePaths.User.Profile(userId))
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

const moreMenuItems = computed((): KitDropdownItem<string>[] => [
  { value: 'edit', label: 'Редактировать', icon: 'mdi:pencil-outline' },
  { value: 'delete', label: 'Удалить', icon: 'mdi:trash-can-outline', isDestructive: true },
])

function handleMenuAction(action: string) {
  if (action === 'edit')
    handleEdit()
  else if (action === 'delete')
    handleDelete()
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

const formattedBudget = computed(() => {
  if (!props.budget || !props.currency)
    return null

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: props.currency,
    minimumFractionDigits: 0,
  }).format(props.budget)
})

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

const tripData = computed<Trip>(() => ({
  id: props.id,
  userId: props.userId ?? '',
  title: props.title,
  imageUrl: props.imageUrl,
  description: props.description,
  descriptionShort: props.descriptionShort,
  startDate: props.startDate,
  endDate: props.endDate,
  cities: props.cities,
  status: props.status,
  budget: props.budget,
  currency: props.currency,
  participants: props.participants,
  tags: props.tags,
  visibility: props.visibility,
  createdAt: props.createdAt ?? new Date().toISOString(),
  updatedAt: props.updatedAt ?? new Date().toISOString(),
  sections: props.sections ?? [],
}))
</script>

<template>
  <div class="travel-card-wrapper" :class="{ 'more-menu-open': isMoreMenuOpen, 'is-highlighted': isHighlight }">
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

        <div class="card-header-row">
          <div class="header-badges">
            <div v-if="isHighlight" class="active-trip-badge">
              <Icon icon="mdi:fire" class="badge-icon" />
              <span>Идёт сейчас</span>
            </div>

            <KitTooltip :text="visibilityIcon.title">
              <div class="card-visibility">
                <Icon :icon="visibilityIcon.icon" />
              </div>
            </KitTooltip>
          </div>

          <div class="card-actions" @click.stop>
            <KitTooltip text="Еще">
              <KitDropdown
                v-model:open="isMoreMenuOpen"
                align="end"
                :items="moreMenuItems"
                @update:model-value="handleMenuAction"
              >
                <template #trigger>
                  <button class="action-btn" aria-label="Еще действия">
                    <Icon icon="mdi:dots-vertical" />
                  </button>
                </template>
              </KitDropdown>
            </KitTooltip>
          </div>
        </div>

        <h3 class="card-title">
          {{ title }}
        </h3>
      </div>

      <div class="card-content">
        <div v-if="descriptionShort" class="card-description">
          {{ descriptionShort }}
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
          <div class="card-participants">
            <div v-if="participants.length" class="participants-list">
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
                  class="clickable-avatar"
                  @click.stop="navigateToProfile(participant.id)"
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
            <div v-else class="no-participants">
              <Icon icon="mdi:account-outline" />
              <span>Нет участников</span>
            </div>
          </div>

          <div class="card-footer-right">
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
      :trip="tripData"
      @save="handleSave"
    />
  </div>
</template>

<style scoped lang="scss">
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

.travel-card-wrapper {
  padding: 8px;
  border-radius: var(--r-xl);
  transition: all 0.3s ease-in-out;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &.is-highlighted {
    background: linear-gradient(135deg, rgba(var(--fg-accent-color-rgb), 0.1), transparent);
    border: 1px solid var(--fg-accent-color);
    padding: 6px;
    box-shadow: 0 4px 20px rgba(var(--fg-accent-color-rgb), 0.15);

    .travel-card {
      box-shadow: none;
    }

    &:hover {
      background-color: rgba(var(--fg-accent-color-rgb), 0.15);
    }
  }
}

.active-trip-badge {
  position: absolute;
  top: 12px;
  left: 16px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background-color: var(--fg-accent-color);
  color: var(--fg-inverted-color);
  border-radius: var(--r-full);
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  animation: pulse-badge 2s infinite;

  .badge-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }
}

@keyframes pulse-badge {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb), 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(var(--fg-accent-color-rgb), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb), 0);
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

  @media (hover: hover) and (pointer: fine) {
    .travel-card-wrapper:hover & {
      box-shadow: var(--s-xl);
      border-color: var(--border-primary-color);
    }
  }
}

.card-image-container {
  position: relative;
  height: 200px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
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
    linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.06) 35%, transparent 55%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0.12) 75%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}

.card-header-row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.active-trip-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background-color: var(--fg-accent-color);
  color: var(--fg-inverted-color);
  border-radius: var(--r-full);
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  animation: pulse-badge 2s infinite;

  .badge-icon {
    font-size: 0.95rem;
    flex-shrink: 0;
  }
}

.card-visibility {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 1.05rem;
  background: rgba(15, 15, 20, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--r-full);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  cursor: default;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: rgba(25, 25, 35, 0.75);
    border-color: rgba(255, 255, 255, 0.3);
    color: #ffffff;
  }
}

.card-title {
  position: relative;
  font-family: var(--font-accent);
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

.card-actions {
  display: flex;
  align-items: center;
  z-index: 3;
  opacity: 0;
  transform: translateX(6px);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  @media (hover: hover) and (pointer: fine) {
    .travel-card-wrapper:hover &,
    .travel-card-wrapper.more-menu-open & {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(15, 15, 20, 0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.92);
    border-radius: var(--r-full);
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    @include hover {
      & {
        background: rgba(40, 40, 55, 0.85);
        border-color: rgba(255, 255, 255, 0.35);
        color: #ffffff;
        transform: translateY(-1px);
      }
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
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);
}

.card-participants {
  display: flex;
  align-items: center;
  gap: 6px;

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

  .participant-avatar {
    margin-left: -8px;

    &:first-child {
      margin-left: 0;
    }
  }

  .no-participants {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--fg-tertiary-color);

    .iconify {
      font-size: 1.2rem;
    }
  }
}

.card-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  width: 1px;
  height: 16px;
  background-color: var(--border-secondary-color);
}
</style>
