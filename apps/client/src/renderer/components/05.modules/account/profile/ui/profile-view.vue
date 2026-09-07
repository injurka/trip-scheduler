<script setup lang="ts">
import type { TabItem } from '~/components/01.kit/kit-tabs/ui/kit-tabs.vue'
import { Icon } from '@iconify/vue'
import { useWindowSize } from '@vueuse/core'
import { computed, markRaw, nextTick, ref, watch } from 'vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { UserQuotaWidget } from '~/components/02.shared/user-quota-widget'
import { DestinationReviewsView } from '~/components/04.features/account/destination-review'
import { HighlightsFeedView } from '~/components/04.features/account/highlights'
import { OpenTripsView } from '~/components/04.features/account/open-trips'
import { TripMapView } from '~/components/04.features/account/trip-map'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { useProfileView } from '../composables/use-profile-view'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const profileView = useProfileView()

// Определение размера экрана для адаптивного поведения
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

// Состояния раскрытия панели на десктопе и квот на мобильном
const isSidebarOpen = ref(false)
const isMobileQuotaOpen = ref(false)
const sidebarRef = ref<HTMLElement | null>(null)

const activeTab = computed({
  get: () => (route.query.tab as string) || 'trip-map',
  set: (newTab: string) => {
    router.replace({ query: { tab: newTab } })
  },
})

const { userProfile } = profileView
const currentUser = computed(() => authStore.user)

const isOwnProfile = computed(() => {
  return currentUser.value?.id === userProfile.value?.id
})

const userId = computed(() => route.params.id as string)

// Индикатор активности кнопки квот в шапке профиля
const isActionActive = computed(() => {
  return isMobile.value ? isMobileQuotaOpen.value : isSidebarOpen.value
})

const actionTooltip = computed(() => {
  if (isMobile.value) {
    return isMobileQuotaOpen.value ? 'Скрыть лимиты' : 'Лимиты тарифа'
  }
  return isSidebarOpen.value ? 'Скрыть статистику и квоты' : 'Статистика и квоты'
})

// Универсальный тоггл для кнопки действий в шапке
function toggleStatsAndQuotas() {
  if (isMobile.value) {
    isMobileQuotaOpen.value = !isMobileQuotaOpen.value
    if (isMobileQuotaOpen.value) {
      nextTick(() => {
        sidebarRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }
  else {
    isSidebarOpen.value = !isSidebarOpen.value
  }
}

// Отображать ли квоты внутри сайдбара
const showQuotas = computed(() => {
  if (!isMobile.value) {
    return isSidebarOpen.value
  }
  return isMobileQuotaOpen.value
})

const tabItems = computed<TabItem[]>(() => [
  {
    id: 'trip-map',
    label: 'Карта',
    icon: 'mdi:map-legend',
    component: markRaw(TripMapView),
  },
  {
    id: 'open-trips',
    label: 'Путешествия',
    icon: 'mdi:compass-outline',
    component: markRaw(OpenTripsView),
    props: {
      userId: userProfile.value?.id,
      isOwnProfile: isOwnProfile.value,
    },
  },
  {
    id: 'highlights',
    label: 'Витрина',
    icon: 'mdi:camera-outline',
    component: markRaw(HighlightsFeedView),
  },
  {
    id: 'ratings',
    label: 'Рейтинги',
    icon: 'mdi:trophy-outline',
    component: markRaw(DestinationReviewsView),
    props: {
      userId: userProfile.value?.id,
      isOwnProfile: isOwnProfile.value,
    },
  },
])

const headerStyle = computed(() => {
  const cover = userProfile.value?.coverUrl ?? '/images/mock.png'

  if (cover) {
    return {
      backgroundImage: `linear-gradient(to top, var(--bg-secondary-color) 10%, transparent 80%), url(${cover})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return {}
})

watch(userId, (newId) => {
  if (newId) {
    profileView.init(newId)
  }
}, { immediate: true })
</script>

<template>
  <div v-if="userProfile" class="profile-view">
    <div class="profile-cover">
      <!-- Основная карточка обложки -->
      <div class="profile-header" :style="headerStyle">
        <div class="avatar-section">
          <KitAvatar
            :src="userProfile.avatarUrl"
            :name="userProfile.name"
            :size="140"
            class="profile-avatar"
          />
        </div>

        <div class="info-section">
          <h1 class="user-name">
            {{ userProfile.name }}
          </h1>
          <div class="user-status">
            <template v-if="userProfile.statusEmoji || userProfile.statusText">
              <span v-if="userProfile.statusEmoji">{{ userProfile.statusEmoji }}</span>
              <span v-if="userProfile.statusText">{{ userProfile.statusText }}</span>
            </template>
          </div>
        </div>

        <!-- Кнопки быстрых действий -->
        <div v-if="isOwnProfile" class="actions-section">
          <button
            type="button"
            class="profile-action-btn"
            :class="{ 'is-active': isActionActive }"
            :title="actionTooltip"
            :aria-label="actionTooltip"
            @click="toggleStatsAndQuotas"
          >
            <Icon width="20" height="20" :icon="isActionActive ? 'mdi:chart-box' : 'mdi:chart-box-outline'" />
          </button>

          <button
            type="button"
            class="profile-action-btn"
            title="Редактировать профиль"
            aria-label="Редактировать профиль"
            @click="router.push(AppRoutePaths.User.Settings(userProfile.id))"
          >
            <Icon width="20" height="20" icon="mdi:pencil-outline" />
          </button>
        </div>
      </div>

      <!-- Боковая панель (скрыта по умолчанию на десктопе, компактна на мобильном) -->
      <aside
        v-if="isOwnProfile"
        ref="sidebarRef"
        class="profile-sidebar"
        :class="{
          'is-desktop-open': isSidebarOpen,
          'is-quota-expanded': isMobileQuotaOpen,
        }"
      >
        <div class="sidebar-inner">
          <!-- Виджет общей статистики -->
          <div class="stats-widget">
            <div class="stat-item">
              <div class="stat-icon-wrap trips">
                <Icon icon="mdi:compass-outline" />
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ userProfile._count?.trips ?? 0 }}</span>
                <span class="stat-label">Путешествий</span>
              </div>
            </div>

            <div class="stat-item">
              <div class="stat-icon-wrap activity">
                <Icon icon="mdi:lightning-bolt-outline" />
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ 0 }}</span>
                <span class="stat-label">Активности</span>
              </div>
            </div>
          </div>

          <!-- Секция квот (раскрывается с плавной анимацией) -->
          <Transition name="quota-expand">
            <div v-if="userProfile.plan && showQuotas" class="quota-section">
              <div class="quota-widgets-list">
                <UserQuotaWidget
                  title="Путешествия"
                  icon="mdi:briefcase-outline"
                  :current="userProfile.currentTripsCount"
                  :limit="userProfile.plan.maxTrips"
                  :to="{ path: AppRoutePaths.User.Quota(userProfile.id) }"
                  unit="items"
                />
                <UserQuotaWidget
                  title="Память"
                  icon="mdi:database-outline"
                  :current="userProfile.currentStorageBytes"
                  :limit="userProfile.plan.maxStorageBytes"
                  unit="bytes"
                  :to="{ path: AppRoutePaths.User.Storage(userProfile.id) }"
                />
                <UserQuotaWidget
                  title="Токены"
                  icon="mdi:robot-outline"
                  :current="userProfile.llmCreditsUsed"
                  :limit="userProfile.plan.monthlyLlmCredits"
                  unit="tokens"
                  :to="{ path: AppRoutePaths.User.Quota(userProfile.id) }"
                />
              </div>
            </div>
          </Transition>
        </div>
      </aside>
    </div>

    <!-- Основное содержимое (вкладки профиля) -->
    <main class="profile-body">
      <KitTabs v-model="activeTab" :items="tabItems" cache />
    </main>
  </div>
</template>

<style scoped lang="scss">
.profile-view {
  position: relative;
  padding-top: 24px;
  min-height: 100%;

  &::before {
    content: '';
    position: absolute;
    inset: -24px 0 0 0;
    pointer-events: none;
    z-index: 0;
    background-image: radial-gradient(circle at 1px 1px, rgba(var(--fg-primary-color-rgb), 0.07) 1px, transparent 0);
    background-size: 24px 24px;
    mask-image: linear-gradient(to bottom, black 0%, black 60%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 0%, black 60%, transparent 100%);
  }
}

.profile-cover {
  position: relative;
  display: flex;
  width: 100%;

  .profile-header {
    position: relative;
    display: flex;
    background-image: linear-gradient(to right, var(--bg-tertiary-color), var(--bg-secondary-color));
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-l);
    overflow: hidden;

    .avatar-section {
      z-index: 2;
      .profile-avatar {
        border: 4px solid var(--bg-primary-color);
        box-shadow: var(--s-m);
      }
    }

    .info-section {
      flex-grow: 1;
      z-index: 2;

      .user-name {
        margin: 0 0 0.25rem;
        font-size: 2rem;
        font-weight: 700;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      }

      .user-status {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-secondary-color);
      }
    }
  }

  /* Блок кнопок действий в шапке */
  .actions-section {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 3;

    .profile-action-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--bg-secondary-color-rgb), 0.85);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--border-secondary-color);
      color: var(--fg-primary-color);
      cursor: pointer;
      box-shadow: var(--s-xs);
      transition: all 0.2s ease;

      &:hover {
        background: rgba(var(--bg-secondary-color-rgb), 1);
        transform: translateY(-2px);
        box-shadow: var(--s-s);
        border-color: var(--border-primary-color);
      }

      &:active {
        transform: translateY(0);
      }

      &.is-active {
        background-color: var(--fg-accent-color);
        color: #ffffff;
        border-color: var(--fg-accent-color);
        box-shadow: 0 4px 12px rgba(var(--fg-accent-color-rgb, 59, 130, 246), 0.35);
      }
    }
  }

  /* Боковая панель со статистикой и лимитами */
  .profile-sidebar {
    background: linear-gradient(135deg, var(--bg-tertiary-color) 0%, var(--bg-secondary-color) 100%);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-l);
    display: flex;
    flex-direction: column;
    box-shadow: var(--s-xs);
  }
}

/* Плитки быстрой статистики */
.stats-widget {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--border-primary-color);
      box-shadow: var(--s-xs);
    }

    .stat-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: var(--r-s);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      flex-shrink: 0;

      &.trips {
        background-color: rgba(var(--fg-accent-color-rgb, 59, 130, 246), 0.12);
        color: var(--fg-accent-color);
      }

      &.activity {
        background-color: rgba(16, 185, 129, 0.12);
        color: #10b981;
      }
    }

    .stat-info {
      display: flex;
      flex-direction: column;
      min-width: 0;

      .stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        line-height: 1.2;
        color: var(--fg-primary-color);
      }

      .stat-label {
        font-size: 0.75rem;
        color: var(--fg-secondary-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}

/* Секция квот */
.quota-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-secondary-color);

  .quota-widgets-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.profile-body {
  display: flex;
  align-items: flex-start;
  padding: 32px 0 0 0;
  width: 100%;
  margin-bottom: 24px;
}

/* Анимация раскрытия аккордеона на мобильных устройствах */
.quota-expand-enter-active,
.quota-expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 500px;
  overflow: hidden;
  opacity: 1;
}

.quota-expand-enter-from,
.quota-expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-6px);
  margin-top: 0;
  padding-top: 0;
}

/* =========================================================================
   ДЕСКТОПНЫЕ СТИЛИ (min-width: 768px): фиксированная высота 320px и слайдер
   ========================================================================= */
@media (min-width: 768px) {
  .profile-cover {
    align-items: stretch;
    height: 320px;
    min-height: 320px;
    max-height: 320px;

    .profile-header {
      align-items: flex-end;
      gap: 2rem;
      flex: 1 1 0%;
      min-width: 0;
      height: 100%;
      min-height: 320px;
      max-height: 320px;
      padding: 0 2rem 2rem;
      box-sizing: border-box;
      transition: flex 0.35s cubic-bezier(0.16, 1, 0.3, 1);

      .user-status {
        height: 34px;
      }
    }

    .actions-section {
      bottom: 14px;
      right: 14px;
    }

    .profile-sidebar {
      width: 320px;
      height: 100%;
      max-height: 320px;
      box-sizing: border-box;
      flex-shrink: 0;
      padding: 8px;
      overflow-x: hidden;
      overflow-y: auto;
      margin-left: 8px;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);

      &:not(.is-desktop-open) {
        max-width: 0;
        width: 0;
        padding: 0;
        margin: 0;
        border-width: 0;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }

      &.is-desktop-open {
        max-width: 320px;
        width: 320px;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .sidebar-inner {
        width: 294px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
    }
  }
}

/* =========================================================================
   МОБИЛЬНЫЕ СТИЛИ (max-width: 767.98px): компактность, без мертвых зон
   ========================================================================= */
@include media-down(md) {
  .profile-view {
    padding-top: 12px;
  }

  .profile-cover {
    flex-direction: column;
    gap: 8px;
    height: auto;
    min-height: auto;
    max-height: none;

    .profile-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
      background: var(--bg-secondary-color);
      padding: 24px 16px 16px;
      min-height: auto;
      max-height: none;
      height: auto;
      gap: 8px;

      .avatar-section {
        margin: 0;
        .profile-avatar {
          margin: 0;
        }
      }

      .info-section {
        padding: 0;
        margin: 0;

        .user-name {
          font-size: 1.5rem;
          margin-bottom: 2px;
        }

        .user-status {
          height: auto;
          justify-content: center;
        }
      }

      .actions-section {
        bottom: 10px;
        right: 10px;
      }
    }

    .profile-sidebar {
      width: 100%;
      max-width: 100%;
      height: auto;
      max-height: none;
      padding: 10px 12px;
      margin: 0;
      background: var(--bg-secondary-color);

      .sidebar-inner {
        width: 100%;
        gap: 8px;
      }
    }
  }

  .stats-widget {
    gap: 8px;

    .stat-item {
      padding: 8px 10px;
      gap: 8px;

      .stat-icon-wrap {
        width: 32px;
        height: 32px;
        font-size: 1.1rem;
      }

      .stat-info {
        .stat-value {
          font-size: 1.1rem;
        }

        .stat-label {
          font-size: 0.7rem;
        }
      }
    }
  }

  .profile-body {
    padding-top: 14px;
  }
}
</style>
