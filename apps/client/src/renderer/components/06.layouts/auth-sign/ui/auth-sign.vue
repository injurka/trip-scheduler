<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { AppRoutePaths } from '~/shared/constants/routes'

enum OAuthProviders { GitHub = 'github', Google = 'google' }

interface Props {
  isLoading?: boolean
}

defineProps<Props>()

const store = useAppStore(['auth'])
const toast = useToast()
const route = useRoute()

const isTelegramLoading = ref(false)

let telegramPollInterval: ReturnType<typeof setInterval> | null = null
let telegramPollTimeout: ReturnType<typeof setTimeout> | null = null

async function handleOAuth(_provider: OAuthProviders) {
  toast.warn('В процессе разработки :)')
}

function stopTelegramPolling() {
  if (telegramPollInterval) {
    clearInterval(telegramPollInterval)
    telegramPollInterval = null
  }
  if (telegramPollTimeout) {
    clearTimeout(telegramPollTimeout)
    telegramPollTimeout = null
  }
  isTelegramLoading.value = false
}

async function loginViaTelegram() {
  if (isTelegramLoading.value)
    return

  try {
    isTelegramLoading.value = true
    const { token, url } = await store.auth.initTelegramLogin()

    window.open(url, '_blank', 'noopener,noreferrer')

    telegramPollInterval = setInterval(async () => {
      try {
        const result = await store.auth.checkTelegramStatus(token)

        if (result?.status === 'confirmed') {
          stopTelegramPolling()
          const returnUrl = route.query.returnUrl as string
          await router.push(returnUrl || AppRoutePaths.Trip.List)
        }
        else if (result?.status === 'cancelled') {
          stopTelegramPolling()
          toast.error('Вход через Telegram отменён.')
        }
        else if (result?.status === 'expired' || result?.status === 'not_found') {
          stopTelegramPolling()
          toast.error('Сессия авторизации истекла. Попробуйте снова.')
        }
      }
      catch {
        stopTelegramPolling()
        toast.error('Ошибка при проверке статуса Telegram.')
      }
    }, 2000)

    telegramPollTimeout = setTimeout(() => {
      if (isTelegramLoading.value) {
        stopTelegramPolling()
        toast.error('Время ожидания входа через Telegram истекло.')
      }
    }, 5 * 60 * 1000)
  }
  catch (error: any) {
    stopTelegramPolling()
    toast.error(error.message || 'Не удалось запустить вход через Telegram.')
  }
}

onUnmounted(() => {
  stopTelegramPolling()
})
</script>

<template>
  <section class="content">
    <div class="card">
      <div v-if="isLoading" class="loader-overlay">
        <Icon icon="mdi:loading" class="spinner" />
      </div>

      <router-link :to="AppRoutePaths.Root" class="logo">
        <Icon icon="mdi:map-marker-path" class="logo-icon" />
        <span class="logo-text">Trip Scheduler</span>
      </router-link>

      <slot name="form" />

      <slot name="utils" />

      <KitDivider :is-loading="isLoading">
        ИЛИ
      </KitDivider>

      <div v-if="false" class="additional-oauth">
        <KitBtn
          variant="outlined"
          color="secondary"
          :disabled="isLoading"
          icon="mdi:google"
          style="flex-grow: 1;"
          @click="handleOAuth(OAuthProviders.Google)"
        >
          Google
        </KitBtn>

        <KitBtn
          variant="outlined"
          color="secondary"
          :disabled="isLoading"
          icon="mdi:github"
          style="flex-grow: 1;"
          @click="handleOAuth(OAuthProviders.GitHub)"
        >
          GitHub
        </KitBtn>
      </div>

      <div class="telegram-oauth">
        <KitBtn
          variant="outlined"
          color="secondary"
          :disabled="isTelegramLoading"
          icon="mdi:send"
          @click="loginViaTelegram"
        >
          {{ isTelegramLoading ? 'Ожидание подтверждения' : 'Войти через Telegram' }}
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

.additional-oauth {
  display: flex;
  gap: 16px;
  margin-top: 24px;
}

.telegram-oauth {
  margin: 16px auto 0;

  > button {
    width: 100%;
  }
}
</style>
