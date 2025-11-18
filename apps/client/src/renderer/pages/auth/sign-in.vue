<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitInput } from '~/components/01.kit/kit-input'
import AuthSignLayout from '~/components/06.layouts/auth-sign/ui/auth-sign.vue'
import { AppRoutePaths } from '~/shared/constants/routes'

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

watch(formError, (newError) => {
  if (newError) {
    toast.error(newError, { expire: 4000 })
  }
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
</script>

<template>
  <AuthSignLayout :is-loading="isLoading">
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
          Я подтверждаю, что прочитал и принимаю <a href="#">Условия использования</a> и <a href="#">Политику конфиденциальности</a>.
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

    a {
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
</style>
