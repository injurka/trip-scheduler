<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitDrawer } from '~/components/01.kit/kit-drawer'
import { KitSwitch } from '~/components/01.kit/kit-switch'
import { OfflineManagerDialog } from '~/components/02.shared/offline-manager'
import { StatusEditorDialog } from '~/components/02.shared/status-editor-dialog'
import { UserQuotaWidget } from '~/components/02.shared/user-quota-widget'
import { AppRouteNames } from '~/shared/constants/routes'
import { useConnectivity } from '~/shared/lib/connectivity'

const open = defineModel<boolean>('open', { required: true })

const { forcedOffline, setForcedOffline } = useConnectivity()
const router = useRouter()
const store = useAppStore(['auth'])

const isStatusEditorOpen = ref(false)
const isOfflineManagerOpen = ref(false)
const menuItems = [
  { label: 'Указать статус', icon: 'mdi:emoticon-happy-outline', action: () => { isStatusEditorOpen.value = true } },
]
const logoutItem = { label: 'Выйти', icon: 'mdi:logout', action: () => handleLogout() }

const offlineMode = computed({ get: () => forcedOffline.value, set: setForcedOffline })
const user = computed(() => store.auth.user)
const mainMenuItems = computed(() => [
  {
    label: 'Мой профиль',
    icon: 'mdi:account-circle-outline',
    action: () => {
      if (user.value) {
        router.push({ name: AppRouteNames.UserProfile, params: { id: user.value.id } })
        open.value = false
      }
    },
  },
  {
    label: 'Мои путешествия',
    icon: 'mdi:briefcase-outline',
    action: () => {
      router.push({ name: AppRouteNames.TripList })
      open.value = false
    },
  },
  {
    label: 'Трекинг активности',
    icon: 'mdi:map-marker-path',
    action: () => {
      router.push({ name: AppRouteNames.ActivityTracking })
      open.value = false
    },
  },
])
const secondaryMenuItems = computed(() => [
  {
    label: 'Настройки',
    icon: 'mdi:cog-outline',
    action: () => {
      if (user.value) {
        router.push({ name: AppRouteNames.UserSettings, params: { id: user.value.id } })
        open.value = false
      }
    },
  },
  {
    label: 'Оффлайн доступ',
    icon: 'mdi:cloud-check-outline',
    action: () => {
      isOfflineManagerOpen.value = true
      open.value = false
    },
  },
  {
    label: 'Полезные ссылки',
    icon: 'mdi:link-variant',
    action: () => {
      router.push({
        name: AppRouteNames.UsefulLinks,
      })
      open.value = false
    },
  },
])

async function handleLogout() {
  await store.auth.signOut()
  open.value = false
  await router.push({ path: AppRoutePaths.Auth.SignIn })
}
</script>

<template>
  <KitDrawer v-model:open="open" side="right">
    <div class="profile-drawer">
      <div class="profile-drawer-body">
        <div v-if="user" class="profile-header">
          <KitAvatar :src="user.avatarUrl" :name="user.name" :size="40" />
          <div class="user-info">
            <span class="user-nickname">{{ user.name }}</span>
            <div
              class="user-status"
              :class="{ 'no-status': !user.statusEmoji && !user.statusText }"
              @click="isStatusEditorOpen = true"
            >
              <template v-if="user.statusEmoji || user.statusText">
                <span v-if="user.statusEmoji" class="status-emoji">{{ user.statusEmoji }}</span>
                <span class="status-text">{{ user.statusText }}</span>
              </template>
              <template v-else>
                <span class="status-placeholder">Указать статус</span>
              </template>
            </div>
          </div>
        </div>

        <div v-if="user && user.plan" class="quota-section">
          <UserQuotaWidget
            title="Путешествия"
            icon="mdi:briefcase-outline"
            :current="user.currentTripsCount"
            :limit="user.plan.maxTrips"
            :to="{ name: AppRouteNames.UserQuota, params: { id: user.id } }"
            unit="items"
            @click="open = false"
          />
          <UserQuotaWidget
            title="Хранилище"
            icon="mdi:database-outline"
            :current="user.currentStorageBytes"
            :limit="user.plan.maxStorageBytes"
            unit="bytes"
            :to="{ name: AppRouteNames.UserStorage, params: { id: user.id } }"
            @click="open = false"
          />
          <UserQuotaWidget
            title="LLM Токены"
            icon="mdi:robot-outline"
            :current="user.llmCreditsUsed"
            :limit="user.plan.monthlyLlmCredits"
            unit="tokens"
            :to="{ name: AppRouteNames.UserQuota, params: { id: user.id } }"
            @click="open = false"
          />
        </div>

        <nav class="drawer-nav">
          <ul>
            <li v-for="item in menuItems" :key="item.label" class="nav-item">
              <button class="nav-button" @click="item.action">
                <Icon :icon="item.icon" class="nav-icon" />
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>

          <KitDivider>
            <Icon icon="mdi:line" />
          </KitDivider>

          <ul>
            <li v-for="item in mainMenuItems" :key="item.label" class="nav-item">
              <button class="nav-button" @click="item.action">
                <Icon :icon="item.icon" class="nav-icon" />
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>

          <KitDivider />

          <ul>
            <li v-for="item in secondaryMenuItems" :key="item.label" class="nav-item">
              <button class="nav-button" @click="item.action">
                <Icon :icon="item.icon" class="nav-icon" />
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>

          <KitDivider />

          <ul>
            <li class="nav-item">
              <button class="nav-button" @click="logoutItem.action">
                <Icon :icon="logoutItem.icon" class="nav-icon" />
                <span>{{ logoutItem.label }}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <footer class="profile-drawer-footer">
        <div
          class="offline-toggle-row"
          :class="{ 'is-offline': offlineMode }"
          role="button"
          tabindex="0"
          :aria-pressed="offlineMode"
          @click="offlineMode = !offlineMode"
          @keydown.space.prevent="offlineMode = !offlineMode"
          @keydown.enter.prevent="offlineMode = !offlineMode"
        >
          <div class="offline-toggle-info">
            <Icon
              :icon="offlineMode ? 'mdi:cloud-off-outline' : 'mdi:cloud-outline'"
              class="offline-toggle-icon"
            />
            <div class="offline-toggle-text">
              <span class="offline-toggle-title">Принудительный офлайн</span>
              <span class="offline-toggle-status">
                {{ offlineMode ? 'Только локальные данные' : 'Автоматический режим' }}
              </span>
            </div>
          </div>
          <KitSwitch
            v-model="offlineMode"
            aria-label="Принудительный офлайн"
            @click.stop
          />
        </div>
      </footer>
    </div>
  </KitDrawer>

  <StatusEditorDialog v-model:visible="isStatusEditorOpen" />
  <OfflineManagerDialog v-model:visible="isOfflineManagerOpen" />
</template>

<style lang="scss" scoped>
.profile-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.profile-drawer-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  box-sizing: border-box;
}

.profile-drawer-footer {
  flex-shrink: 0;
  padding: 10px 12px;
  padding-bottom: max(10px, calc(10px + var(--safe-area-inset-bottom, 0px)));
  border-top: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  box-sizing: border-box;
}

.offline-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--r-s);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &:focus-visible {
    outline: none;
    background-color: var(--bg-hover-color);
  }
}

.offline-toggle-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.offline-toggle-icon {
  font-size: 1.25rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
  transition: color 0.2s ease;

  .is-offline & {
    color: var(--fg-accent-color);
  }
}

.offline-toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.offline-toggle-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.offline-toggle-status {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease;

  .is-offline & {
    color: var(--fg-accent-color);
  }
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 8px;

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .user-nickname {
    font-weight: 600;
    font-size: 1rem;
    color: var(--fg-primary-color);
  }

  .user-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    padding: 2px 6px;
    background-color: var(--bg-tertiary-color);
    border-radius: var(--r-xs);
    max-width: fit-content;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--bg-hover-color);
    }

    &.no-status .status-placeholder {
      font-style: italic;
    }

    .status-emoji {
      font-size: 0.9rem;
    }
  }
}

.quota-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: var(--r-m);
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }

  .nav-button {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px;
    border-radius: var(--r-s);
    background: transparent;
    border: none;
    color: var(--fg-primary-color);
    font-size: 0.9rem;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--bg-hover-color);
    }

    .nav-icon {
      font-size: 1.1rem;
      margin-right: 12px;
      color: var(--fg-secondary-color);
    }
  }
}
</style>
