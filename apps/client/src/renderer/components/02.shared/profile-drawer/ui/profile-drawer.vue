<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitDrawer } from '~/components/01.kit/kit-drawer'
import { StatusEditorDialog } from '~/components/02.shared/status-editor-dialog'
import { UserQuotaWidget } from '~/components/02.shared/user-quota-widget'
import { AppRouteNames } from '~/shared/constants/routes'

const open = defineModel<boolean>('open', { required: true })
const router = useRouter()

const store = useAppStore(['auth'])
const user = computed(() => store.auth.user)
const isStatusEditorOpen = ref(false)

const menuItems = [
  { label: 'Указать статус', icon: 'mdi:emoticon-happy-outline', action: () => { isStatusEditorOpen.value = true } },
]

const mainMenuItems = [
  {
    label: 'Мой профиль',
    icon: 'mdi:account-circle-outline',
    action: () => {
      router.push({ name: AppRouteNames.AccountProfile })
      open.value = false
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
    label: 'Сообщества',
    icon: 'mdi:account-group-outline',
    action: () => {
      router.push({ name: AppRouteNames.CommunitiesList })
      open.value = false
    },
  },
]

const secondaryMenuItems = [
  // { label: 'Возможности', icon: 'mdi:flask-outline', action: () => {} },
  {
    label: 'Настройки',
    icon: 'mdi:cog-outline',
    action: () => {
      router.push({
        name: AppRouteNames.AccountSettings,
      })
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
]

async function handleLogout() {
  await store.auth.signOut()
  open.value = false
  await router.push({ path: AppRoutePaths.Auth.SignIn })
}

const logoutItem = { label: 'Выйти', icon: 'mdi:logout', action: () => handleLogout() }
</script>

<template>
  <KitDrawer v-model:open="open" side="right">
    <div class="profile-drawer">
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
          :to="{ name: AppRouteNames.AccountQuota }"
          unit="items"
          @click="open = false"
        />
        <UserQuotaWidget
          title="Хранилище"
          icon="mdi:database-outline"
          :current="user.currentStorageBytes"
          :limit="user.plan.maxStorageBytes"
          unit="bytes"
          :to="{ name: AppRouteNames.AccountStorage }"
          @click="open = false"
        />
        <UserQuotaWidget
          title="LLM Токены"
          icon="mdi:robot-outline"
          :current="user.llmCreditsUsed"
          :limit="user.plan.monthlyLlmCredits"
          unit="tokens"
          :to="{ name: AppRouteNames.AccountQuota }"
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
  </KitDrawer>
  <StatusEditorDialog v-model:visible="isStatusEditorOpen" />
</template>

<style lang="scss" scoped>
.profile-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
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
