<script setup lang="ts">
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { Icon } from '@iconify/vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { UserQuotaWidget } from '~/components/02.shared/user-quota-widget'
import { AppRouteNames } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { useProfileView } from '../composables/use-profile-view'
import { RecentTripCard } from './components'

const route = useRoute()
const authStore = useAuthStore()
const router = useRouter()
const profileView = useProfileView()

const activeTab = ref('trips')
const { userProfile, recentTrips, isLoading } = profileView
const currentUser = computed(() => authStore.user)

const isOwnProfile = computed(() => {
  return currentUser.value?.id === userProfile.value?.id
})

const userId = computed(() => route.params.id as string)

const tabItems: ViewSwitcherItem[] = [
  { id: 'trips', label: 'Путешествия', icon: 'mdi:map-legend' },
  { id: 'activity', label: 'Активность', icon: 'mdi:pulse' },
]

watch(userId, (newId) => {
  if (newId) {
    profileView.init(newId)
  }
}, { immediate: true })
</script>

<template>
  <div v-if="userProfile" class="profile-view">
    <div class="profile-cover">
      <div class="profile-header">
        <div class="avatar-section">
          <KitAvatar :src="userProfile.avatarUrl" :name="userProfile.name" :size="140" class="profile-avatar" />
        </div>
        <div class="info-section">
          <h1 class="user-name">
            {{ userProfile.name }}
          </h1>
          <div v-if="userProfile.statusEmoji || userProfile.statusText" class="user-status">
            <span v-if="userProfile.statusEmoji">{{ userProfile.statusEmoji }}</span>
            <span v-if="userProfile.statusText">{{ userProfile.statusText }}</span>
          </div>
          <p class="user-bio">
            Путешественник и исследователь. В поисках новых горизонтов и незабываемых впечатлений.
          </p>
        </div>
        <div v-if="isOwnProfile" class="actions-section">
          <KitBtn
            variant="outlined"
            color="secondary"
            @click="router.push(AppRoutePaths.User.Settings(userProfile.id))"
          >
            <Icon icon="mdi:pencil-outline" />
            Редактировать
          </KitBtn>
        </div>
      </div>
    </div>

    <div class="profile-body">
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
            title="Хранилище"
            icon="mdi:database-outline"
            :current="userProfile.currentStorageBytes"
            :limit="userProfile.plan.maxStorageBytes"
            unit="bytes"
            :to="{ path: AppRoutePaths.User.Storage(userProfile.id) }"
          />
          <UserQuotaWidget
            title="LLM Токены"
            icon="mdi:robot-outline"
            :current="userProfile.llmCreditsUsed"
            :limit="userProfile.plan.monthlyLlmCredits"
            unit="tokens"
            :to="{ path: AppRoutePaths.User.Quota(userProfile.id) }"
          />
        </div>
      </aside>
      <main class="profile-main-content">
        <KitTabs v-model="activeTab" :items="tabItems">
          <template #trips>
            <div class="tab-content">
              <AsyncStateWrapper :loading="isLoading" :data="recentTrips.length > 0 ? recentTrips : null">
                <template #success="{ data }">
                  <div class="recent-trips-list">
                    <RecentTripCard v-for="trip in data" :key="trip.id" :trip="trip" />
                  </div>
                </template>
                <template #empty>
                  <div class="empty-trips">
                    <p>Пока нет недавних путешествий для отображения.</p>
                    <KitBtn @click="router.push({ name: AppRouteNames.TripList })">
                      Посмотреть все путешествия
                    </KitBtn>
                  </div>
                </template>
              </AsyncStateWrapper>
            </div>
          </template>
          <template #activity>
            <div class="tab-content">
              <p>Раздел в разработке</p>
            </div>
          </template>
        </KitTabs>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-view {
  padding-top: 24px;
}

.profile-cover {
  min-height: 250px;
  background: linear-gradient(to right, var(--bg-tertiary-color), var(--bg-secondary-color));
  border-radius: var(--r-l);
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 0 2rem 2rem;
}

.profile-header {
  display: flex;
  align-items: flex-end;
  gap: 2rem;
  width: 100%;
}

.avatar-section {
  .profile-avatar {
    border: 4px solid var(--bg-primary-color);
    z-index: 2;
  }
}

.info-section {
  flex-grow: 1;
  .user-name {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }
  .user-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--fg-secondary-color);
    margin-bottom: 0.5rem;
  }
  .user-bio {
    font-size: 0.9rem;
    color: var(--fg-tertiary-color);
    max-width: 500px;
  }
}

.actions-section {
  align-self: flex-end;
}

.profile-body {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  padding: 32px 0 0 0;
  align-items: start;
}

.profile-sidebar,
.profile-main-content {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1.5rem;
}

.widget-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem;
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
  border-top: 1px solid var(--border-secondary-color);
  margin-top: 24px;
  padding-top: 8px;
}

.tab-content {
  h3 {
    margin-top: 0;
  }
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
  .profile-body {
    grid-template-columns: 1fr;
  }
  .profile-sidebar {
    order: 2;
  }
  .profile-main-content {
    padding: 8px;
  }
}
@include media-down(sm) {
  .profile-cover {
    height: auto;
    padding-top: 1.5rem;
  }
  .profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: -20px;
  }
  .avatar-section .profile-avatar {
    margin-bottom: -70px;
  }
  .info-section {
    padding-top: 50px;
  }
  .actions-section {
    width: 100%;
    .kit-btn {
      width: 100%;
    }
  }
  .profile-body {
    padding-top: 2rem;
  }
}
</style>
