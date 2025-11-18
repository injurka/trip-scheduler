<script setup lang="ts">
import type { TelegramAuthPayload } from '~/shared/types/models/auth'
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

const telegramContainer = ref<HTMLElement | null>(null)

async function handleOAuth(_provider: OAuthProviders) {
  toast.warn('В процессе разработки :)')
}

async function onTelegramAuth(authData: TelegramAuthPayload) {
  try {
    await store.auth.signInWithTelegram(authData)
    const returnUrl = route.query.returnUrl as string
    router.push(returnUrl || AppRoutePaths.Trip.List)
  }
  catch (error: any) {
    toast.error(error.message || 'Ошибка входа через Telegram.')
  }
}

onMounted(() => {
  (window as any).onTelegramAuth = onTelegramAuth

  if (telegramContainer.value) {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'trip_scheduler_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')

    telegramContainer.value.innerHTML = ''
    telegramContainer.value.appendChild(script)
  }
})

onUnmounted(() => {
  if ((window as any).onTelegramAuth) {
    delete (window as any).onTelegramAuth
  }
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

      <div class="additional-oauth">
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

      <div class="custom-telegram-wrapper">
        <KitBtn
          variant="outlined"
          color="secondary"
          :disabled="isLoading"
          icon="mdi:telegram"
          class="my-custom-telegram-button"
        >
          Войти через Telegram
        </KitBtn>
        <div ref="telegramContainer" class="telegram-login-wrapper" />
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

  @include media-down(xs) {
    padding: 24px;
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

.custom-telegram-wrapper {
  position: relative;
  width: 238px;
  height: 42px;
  margin: 16px auto 0;
  cursor: pointer;

  .my-custom-telegram-button {
    width: 100%;
    height: 100%;
    pointer-events: none;
    transition: all 0.2s ease-in-out;
  }

  .telegram-login-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.0001;
    overflow: hidden;
  }

  &:hover .my-custom-telegram-button {
    transform: translateY(-2px);
    box-shadow: var(--s-l);
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }
}
</style>
