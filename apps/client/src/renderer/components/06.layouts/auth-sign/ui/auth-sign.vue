<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onBeforeUnmount, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

enum OAuthProviders {
  GitHub = 'github',
  Google = 'google',
  Yandex = 'yandex',
}

interface Props {
  isLoading?: boolean
}

defineProps<Props>()

const authStore = useAuthStore()
const router = useRouter()
const isTelegramLoading = ref(false)
let statusInterval: any = null

onBeforeUnmount(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})

function handleOAuth(provider: OAuthProviders) {
  const serverUrl = import.meta.env.VITE_APP_SERVER_URL || ''
  window.location.href = `${serverUrl}/api/auth/${provider}/login`
}

async function handleTelegramAuth() {
  if (isTelegramLoading.value)
    return

  isTelegramLoading.value = true
  try {
    const { token, url } = await authStore.initTelegramAuth()

    window.open(url, '_blank')

    statusInterval = setInterval(async () => {
      try {
        const res = await authStore.checkTelegramAuthStatus(token)
        if (res.status === 'confirmed') {
          clearInterval(statusInterval)
          isTelegramLoading.value = false
          useToast().success('Вы успешно вошли!')
          router.push(AppRoutePaths.Trip.List)
        }
        else if (res.status === 'cancelled' || res.status === 'expired') {
          clearInterval(statusInterval)
          isTelegramLoading.value = false
          useToast().error('Вход через Telegram отменен или время сессии истекло')
        }
      }
      catch {
        clearInterval(statusInterval)
        isTelegramLoading.value = false
        useToast().error('Ошибка при проверке статуса авторизации')
      }
    }, 2000)
  }
  catch {
    isTelegramLoading.value = false
    useToast().error('Не удалось инициализировать авторизацию через Telegram')
  }
}
</script>

<template>
  <section class="content">
    <div class="card">
      <div v-if="isLoading || isTelegramLoading" class="loader-overlay">
        <Icon icon="mdi:loading" class="spinner" />
      </div>

      <router-link :to="AppRoutePaths.Root" class="logo">
        <Icon icon="mdi:map-marker-path" class="logo-icon" />
        <span class="logo-text">Trip Scheduler</span>
      </router-link>

      <slot name="form" />

      <slot name="utils" />

      <KitDivider class="section-divider" :is-loading="isLoading || isTelegramLoading">
        ИЛИ
      </KitDivider>

      <div class="additional-oauth">
        <KitBtn
          v-if="false"
          variant="outlined"
          color="secondary"
          :disabled="isLoading || isTelegramLoading"
          icon="mdi:google"
          style="flex-grow: 1;"
          @click="handleOAuth(OAuthProviders.Google)"
        >
          Google
        </KitBtn>

        <KitBtn
          v-if="false"
          variant="outlined"
          color="secondary"
          :disabled="isLoading || isTelegramLoading"
          icon="mdi:github"
          style="flex-grow: 1;"
          @click="handleOAuth(OAuthProviders.GitHub)"
        >
          GitHub
        </KitBtn>

        <KitBtn
          variant="outlined"
          color="secondary"
          :disabled="isLoading || isTelegramLoading"
          style="flex-grow: 1;"
          @click="handleOAuth(OAuthProviders.Yandex)"
        >
          <span class="yandex-icon-badge">Я</span>
          Яндекс
        </KitBtn>

        <KitBtn
          variant="outlined"
          color="secondary"
          :disabled="isLoading || isTelegramLoading"
          :is-loading="isTelegramLoading"
          icon="mdi:telegram"
          style="flex-grow: 1;"
          @click="handleTelegramAuth"
        >
          Telegram
        </KitBtn>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.content {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 16px;
}

.card {
  position: relative;
  width: 100%;
  max-width: 420px;
  margin: 16px;
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-l);
  border-radius: var(--r-l);
  padding: 32px;
  overflow: hidden;
  background-color: rgba(var(--bg-primary-color-rgb), 0.5);

  @include media-down(xs) {
    padding: 16px;
    margin: 0px;
  }
}

.loader-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary-color);
  z-index: 20;

  .spinner {
    font-size: 3rem;
    color: var(--fg-accent-color);
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 32px;
  text-decoration: none;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
  color: var(--fg-primary-color);

  .logo-icon {
    font-size: 2.5rem;
    color: var(--fg-accent-color);
  }
  .logo-text {
    font-size: 1.5rem;
    font-weight: 600;
  }
}

.section-divider {
  margin-top: 16px;
}

.additional-oauth {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 24px;
}

.yandex-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fc3f1d;
  color: #ffffff;
  font-family:
    Arial,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}
</style>
