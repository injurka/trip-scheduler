<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitInput } from '~/components/01.kit/kit-input'
import AuthSignLayout from '~/components/06.layouts/auth-sign/ui/auth-sign.vue'
import { AppRouteNames, AppRoutePaths } from '~/shared/constants/routes'

enum OAuthErrors { MissingToken = 'missing_token', MeError = 'me_error' }

const emailRules = [
  (v: string) => !!v || 'Почтовый адрес обязателен',
  (v: string) => /.[^\n\r@\u2028\u2029]*@.+\..+/.test(v) || 'Неверный формат почты',
]

const passwordRules = [
  (v: string) => !!v || 'Пароль обязателен',
  (v: string) => v.length >= 8 || 'Пароль должен быть не менее 8 символов',
]

const store = useAppStore(['auth'])
const toast = useToast()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const terms = ref(false)
const formError = ref<string | null>(null)
const isPasswordVisible = ref(false)
const isTelegramLoading = ref(false)

let telegramPollInterval: ReturnType<typeof setInterval> | null = null
let telegramPollTimeout: ReturnType<typeof setTimeout> | null = null

const isLoading = computed(() => store.auth.isLoading)
const passwordInputType = computed(() => isPasswordVisible.value ? 'text' : 'password')
const passwordToggleIcon = computed(() => isPasswordVisible.value ? 'mdi-eye-off-outline' : 'mdi-eye-outline')

async function submitSignIn() {
  formError.value = null

  const emailError = emailRules.map(rule => rule(email.value)).find(res => res !== true)
  if (emailError) {
    formError.value = emailError
    return
  }

  const passwordError = passwordRules.map(rule => rule(password.value)).find(res => res !== true)
  if (passwordError) {
    formError.value = passwordError
    return
  }

  if (!terms.value) {
    formError.value = 'Необходимо принять условия использования.'
    return
  }

  try {
    await store.auth.signIn({ email: email.value, password: password.value })
    const returnUrl = route.query.returnUrl as string
    await router.push(returnUrl || AppRoutePaths.Trip.List)
  }
  catch (error: any) {
    toast.error(error.message || 'Произошла ошибка при авторизации.')
  }
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

    // Открываем Telegram (десктоп или мобайл)
    window.open(url, '_blank')

    // Поллим статус каждые 2 секунды
    telegramPollInterval = setInterval(async () => {
      try {
        const result = await store.auth.checkTelegramStatus(token)

        if (result.status === 'confirmed') {
          stopTelegramPolling()
          const returnUrl = route.query.returnUrl as string
          await router.push(returnUrl || AppRoutePaths.Trip.List)
        }
        else if (result.status === 'cancelled') {
          stopTelegramPolling()
          toast.error('Вход через Telegram отменён.')
        }
        else if (result.status === 'expired' || result.status === 'not_found') {
          stopTelegramPolling()
          toast.error('Сессия авторизации истекла. Попробуйте снова.')
        }
      }
      catch {
        stopTelegramPolling()
        toast.error('Ошибка при проверке статуса Telegram.')
      }
    }, 2000)

    // Таймаут — 5 минут
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

watch(formError, (newError) => {
  if (newError)
    toast.error(newError, { expire: 4000 })
})

onMounted(() => {
  const oauthError = route.query.oa_error as OAuthErrors
  if (oauthError) {
    let msg = ''
    switch (oauthError) {
      case OAuthErrors.MissingToken:
        msg = 'Ошибка при OAuth авторизации.'
        break
      case OAuthErrors.MeError:
        msg = 'Не удалось получить данные пользователя.'
        break
    }
    toast.error(msg)
    router.replace({ query: {} })
  }
})

onUnmounted(() => {
  stopTelegramPolling()
})
</script>

<template>
  <AuthSignLayout :is-loading="isLoading || isTelegramLoading">
    <template #form>
      <form class="form" @submit.prevent="submitSignIn">
        <KitInput
          v-model="email"
          label="Почтовый адрес"
          type="email"
          name="email"
          icon="mdi-email-outline"
          placeholder="user@example.com"
          required
        />

        <KitInput
          v-model="password"
          label="Пароль"
          :type="passwordInputType"
          name="password"
          icon="mdi-lock-outline"
          placeholder="••••••••"
          required
        >
          <template #append>
            <button
              type="button"
              class="icon-btn"
              @click="isPasswordVisible = !isPasswordVisible"
            >
              <Icon :icon="passwordToggleIcon" />
            </button>
          </template>
        </KitInput>

        <KitCheckbox v-model="terms">
          Я принимаю
          <router-link :to="{ name: AppRouteNames.Terms }" target="_blank" class="auth-link">
            Условия использования
          </router-link>
          и
          <router-link :to="{ name: AppRouteNames.Privacy }" target="_blank" class="auth-link">
            Политику конфиденциальности
          </router-link>.
        </KitCheckbox>

        <KitBtn
          type="submit"
          :disabled="isLoading || !terms"
          style="width: 100%;"
        >
          Авторизоваться
        </KitBtn>
      </form>
    </template>

    <template #utils>
      <div class="utils">
        <router-link :to="AppRoutePaths.Auth.ForgotPassword" class="util-link">
          Забыли пароль?
        </router-link>
        <router-link :to="{ path: AppRoutePaths.Auth.SignUp, query: route.query }" class="util-link">
          Создать аккаунт
        </router-link>
      </div>
    </template>

    <template #social>
      <div class="social">
        <div class="social-divider">
          <span>или</span>
        </div>

        <div class="social-row">
          <a class="social-btn" href="/api/auth/google/login">
            <Icon icon="flat-color-icons:google" class="social-icon" />
            Google
          </a>
          <a class="social-btn" href="/api/auth/github/login">
            <Icon icon="mdi:github" class="social-icon" />
            GitHub
          </a>
        </div>

        <KitBtn
          class="tg-btn"
          :disabled="isTelegramLoading"
          style="width: 100%;"
          @click="loginViaTelegram"
        >
          <Icon
            :icon="isTelegramLoading ? 'mdi:loading' : 'mdi:send'"
            :class="{ spin: isTelegramLoading }"
            class="tg-icon"
          />
          {{ isTelegramLoading ? 'Ожидание подтверждения в Telegram...' : 'Войти через Telegram' }}
        </KitBtn>
      </div>
    </template>
  </AuthSignLayout>
</template>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;

  :deep(.kit-checkbox-wrapper) {
    .kit-checkbox-label {
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      line-height: 1.5;
    }

    .auth-link {
      color: var(--fg-accent-color);
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.icon-btn {
  display: flex;
  color: var(--fg-secondary-color);
  padding: 4px;
  border-radius: 50%;
  &:hover {
    color: var(--fg-primary-color);
    background-color: rgba(var(--fg-primary-color-rgb), 0.1);
  }
}

.utils {
  display: flex;
  justify-content: space-between;
  margin: 16px 0 24px;
}

.util-link {
  font-size: 0.875rem;
  color: var(--fg-accent-color);
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}

.social {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.social-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--border-secondary-color);
  }
}

.social-row {
  display: flex;
  gap: 12px;
}

.social-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  color: var(--fg-primary-color);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background-color: rgba(var(--fg-primary-color-rgb), 0.05);
    border-color: var(--border-primary-color);
  }

  .social-icon {
    font-size: 1.25rem;
  }
}

.tg-btn {
  .tg-icon {
    font-size: 1.1rem;
    margin-right: 4px;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
