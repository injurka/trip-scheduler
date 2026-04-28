<script setup lang="ts">
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { Icon } from '@iconify/vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { UserQuotaWidget } from '~/components/02.shared/user-quota-widget'
import { DestinationReviewsView } from '~/components/04.features/account/destination-review'
import { HighlightsFeedView } from '~/components/04.features/account/highlights'
import { TripMapView } from '~/components/04.features/account/trip-map'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { useProfileView } from '../composables/use-profile-view'

const route = useRoute()
const authStore = useAuthStore()
const router = useRouter()
const profileView = useProfileView()

const activeTab = ref('trip-map')
const { userProfile } = profileView
const currentUser = computed(() => authStore.user)

const isOwnProfile = computed(() => {
  return currentUser.value?.id === userProfile.value?.id
})

const userId = computed(() => route.params.id as string)

const tabItems: ViewSwitcherItem[] = [
  { id: 'trip-map', label: 'Карта', icon: 'mdi:map-legend' },
  { id: 'highlights', label: 'Витрина', icon: 'mdi:camera-outline' },
  { id: 'ratings', label: 'Рейтинги', icon: 'mdi:trophy-outline' },
]

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
      <div class="profile-header" :style="headerStyle">
        <div class="avatar-section">
          <KitAvatar :src="userProfile.avatarUrl" :name="userProfile.name" :size="140" class="profile-avatar" />
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
        <div v-if="isOwnProfile" class="actions-section">
          <KitBtn
            variant="subtle"
            color="secondary"
            size="md"
            @click="router.push(AppRoutePaths.User.Settings(userProfile.id))"
          >
            <Icon width="20" height="20" icon="mdi:pencil-outline" />
          </KitBtn>
        </div>
      </div>

      <aside class="profile-sidebar">
        <div class="stats-widget">
          <div class="stat-item">
            <span class="stat-value">{{ userProfile._count?.trips ?? 0 }}</span>
            <span class="stat-label">Путешествий</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ 0 }}</span>
            <span class="stat-label">Активности</span>
          </div>
        </div>

        <div v-if="isOwnProfile && userProfile.plan" class="quota-section">
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
      </aside>
    </div>

    <main class="profile-body">
      <KitTabs v-model="activeTab" :items="tabItems">
        <template #trip-map>
          <div class="tab-content">
            <TripMapView />
          </div>
        </template>

        <template #highlights>
          <div class="tab-content">
            <HighlightsFeedView />
          </div>
        </template>

        <template #ratings>
          <div class="tab-content">
            <DestinationReviewsView
              :user-id="userProfile.id"
              :is-own-profile="isOwnProfile"
            />
          </div>
        </template>
      </KitTabs>
    </main>
  </div>
</template>

<style scoped lang="scss">
.profile-view {
  padding-top: 24px;
}

.profile-cover {
  display: flex;
  gap: 8px;

  .profile-header {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 2rem;
    width: 100%;
    min-height: 250px;
    padding: 0 2rem 2rem;
    background-image: linear-gradient(to right, var(--bg-tertiary-color), var(--bg-secondary-color));
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-l);
    overflow: hidden;

    .avatar-section {
      z-index: 2;
      .profile-avatar {
        border: 4px solid var(--bg-primary-color);
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
        height: 34px;
        color: var(--fg-secondary-color);
      }
    }
  }

  .actions-section {
    position: absolute;
    top: 10px;
    right: 10px;
    align-self: flex-end;
    z-index: 3;

    > button {
      width: 46px;
      border-radius: 50%;
      background: rgba(var(--bg-secondary-color-rgb), 0.8);
    }
  }

  .profile-sidebar {
    min-width: 280px;
    padding: 16px;
    background: linear-gradient(to left, var(--bg-tertiary-color), var(--bg-secondary-color));
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-l);
  }
}

.profile-body {
  display: flex;
  align-items: flex-start;
  padding: 32px 0 0 0;
  width: 100%;
}

.stats-widget {
  display: flex;
  justify-content: space-around;
  text-align: center;

  .stat-item {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
  }
}

.quota-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid var(--border-secondary-color);
}

.tab-content {
  width: 100%;
  p {
    color: var(--fg-secondary-color);
  }
}

.recent-trips-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-trips {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  color: var(--fg-secondary-color);
}

@include media-down(md) {
  .profile-cover {
    flex-direction: column;

    .profile-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
      background: var(--bg-secondary-color);
      padding-top: 32px;
    }

    .profile-sidebar {
      background: var(--bg-secondary-color);
    }
  }

  .avatar-section .profile-avatar {
    margin-bottom: -70px;
  }

  .info-section {
    padding-top: 50px;
  }

  .profile-body {
    padding-top: 2rem;
  }
}
</style>
