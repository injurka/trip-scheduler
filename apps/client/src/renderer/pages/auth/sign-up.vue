<script setup lang="ts">
import type { SignUpPayload } from '~/shared/types/models/auth'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitInput } from '~/components/01.kit/kit-input'
import AuthSignLayout from '~/components/06.layouts/auth-sign/ui/auth-sign.vue'
import { AppRoutePaths } from '~/shared/constants/routes'

const store = useAppStore(['auth'])
const toast = useToast()
const router = useRouter()
const route = useRoute()

const step = ref<'details' | 'verify'>('details')

const form = reactive<SignUpPayload & { confirmPassword: string }>({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const verificationCode = ref('')
const terms = ref(false)
const formError = ref<string | null>(null)
const isPasswordVisible = ref(false)

const emailRules = [
  (v: string) => !!v || 'Почтовый адрес обязателен',
  (v: string) => /.[^\n\r@\u2028\u2029]*@.+\..+/.test(v) || 'Неверный формат почты',
]
const nameRules = [(v: string) => !!v || 'Имя обязательно']
const passwordRules = [
  (v: string) => !!v || 'Пароль обязателен',
  (v: string) => v.length >= 6 || 'Пароль должен быть не менее 6 символов',
]
const confirmPasswordRules = [
  (v: string) => !!v || 'Подтверждение пароля обязательно',
  (v: string) => v === form.password || 'Пароли не совпадают',
]
const verificationCodeRules = [
  (v: string) => !!v || 'Код обязателен',
  (v: string) => v.length === 6 || 'Код должен состоять из 6 цифр',
]

function validateDetailsForm(): boolean {
  const checks = [
    ...nameRules.map(rule => rule(form.name)),
    ...emailRules.map(rule => rule(form.email)),
    ...passwordRules.map(rule => rule(form.password)),
    ...confirmPasswordRules.map(rule => rule(form.confirmPassword)),
  ]

  const error = checks.find(res => res !== true)
  if (error) {
    formError.value = error as string
    return false
  }

  if (!terms.value) {
    formError.value = 'Необходимо принять условия использования.'
    return false
  }

  formError.value = null
  return true
}

function validateVerificationForm(): boolean {
  const checks = [
    ...verificationCodeRules.map(rule => rule(verificationCode.value)),
  ]
  const error = checks.find(res => res !== true)
  if (error) {
    formError.value = error as string
    return false
  }
  formError.value = null
  return true
}

async function submitSignUp() {
  if (!validateDetailsForm()) {
    return
  }

  try {
    await store.auth.signUp({
      name: form.name,
      email: form.email,
      password: form.password,
    })
    step.value = 'verify'
    toast.success('Код подтверждения отправлен на вашу почту.')
  }
  catch (error: any) {
    toast.error(error.message || 'Произошла ошибка при отправке кода.')
  }
}

async function submitVerification() {
  if (!validateVerificationForm()) {
    return
  }

  try {
    await store.auth.verifyEmail({
      email: form.email,
      token: verificationCode.value,
    })
    await router.push(AppRoutePaths.Trip.List)
  }
  catch (error: any) {
    toast.error(error.message || 'Произошла ошибка при подтверждении почты.')
  }
}

const isLoading = computed(() => store.auth.isLoading)
const passwordInputType = computed(() => (isPasswordVisible.value ? 'text' : 'password'))
const passwordToggleIcon = computed(() => (isPasswordVisible.value ? 'mdi:eye-off-outline' : 'mdi:eye-outline'))

watch(formError, (newError) => {
  if (newError) {
    toast.error(newError, { expire: 4000 })
  }
})
</script>

<template>
  <AuthSignLayout :is-loading="isLoading">
    <template #form>
      <!-- Step 1: Details Form -->
      <form v-if="step === 'details'" class="form" @submit.prevent="submitSignUp">
        <KitInput
          v-model="form.name"
          label="Ваше имя"
          type="text"
          name="name"
          icon="mdi:account-outline"
          placeholder="Иван Петров"
          required
        />
        <KitInput
          v-model="form.email"
          label="Почтовый адрес"
          type="email"
          name="email"
          icon="mdi:email-outline"
          placeholder="user@example.com"
          required
        />
        <KitInput
          v-model="form.password"
          label="Пароль"
          :type="passwordInputType"
          name="password"
          icon="mdi:lock-outline"
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
        <KitInput
          v-model="form.confirmPassword"
          label="Подтвердите пароль"
          :type="passwordInputType"
          name="confirmPassword"
          icon="mdi:lock-check-outline"
          placeholder="••••••••"
          required
        />

        <KitCheckbox v-model="terms">
          Я принимаю <a href="#">Условия использования</a> и <a href="#">Политику конфиденциальности</a>.
        </KitCheckbox>

        <KitBtn
          type="submit"
          :disabled="isLoading || !terms"
          style="width: 100%; margin-top: 8px;"
        >
          Зарегистрироваться
        </KitBtn>
      </form>

      <!-- Step 2: Verification Form -->
      <form v-if="step === 'verify'" class="form" @submit.prevent="submitVerification">
        <p class="verification-info">
          Мы отправили 6-значный код на <strong>{{ form.email }}</strong>. Пожалуйста, введите его ниже.
        </p>
        <KitInput
          v-model="verificationCode"
          label="Код подтверждения"
          type="text"
          name="verificationCode"
          icon="mdi:numeric"
          placeholder="123456"
          required
          maxlength="6"
        />
        <KitBtn
          type="submit"
          :disabled="isLoading"
          style="width: 100%; margin-top: 8px;"
        >
          Подтвердить и войти
        </KitBtn>
        <button type="button" class="util-link" style="margin-top: 16px; background: none; border: none; cursor: pointer;" @click="step = 'details'">
          Изменить email
        </button>
      </form>
    </template>
    <template #utils>
      <div class="utils">
        <router-link :to="{ path: AppRoutePaths.Auth.SignIn, query: route.query }" class="util-link">
          Уже есть аккаунт? Войти
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

.verification-info {
  text-align: center;
  color: var(--fg-secondary-color);
  line-height: 1.5;
  margin-bottom: 16px;
  strong {
    color: var(--fg-primary-color);
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
  justify-content: center;
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
