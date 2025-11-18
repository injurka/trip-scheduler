<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

enum OAuthErrors { MissingToken = 'missing_token', MeError = 'me_error' }

const route = useRoute()
const store = useAuthStore()
const router = useRouter()

async function authorizationCallback() {
  const token = route.query.token as string
  const refreshToken = route.query.refreshToken as string

  if (!token) {
    return router.push({
      path: AppRoutePaths.Auth.SignIn,
      query: { oa_error: OAuthErrors.MissingToken },
    })
  }

  store.saveTokens({ accessToken: token, refreshToken })

  await nextTick()
  await validateUser()
}

async function validateUser() {
  try {
    await store.me()
    router.push({
      path: AppRoutePaths.Trip.List,
    })
  }
  catch {
    router.push({
      path: AppRoutePaths.Auth.SignIn,
      query: {
        oa_error: OAuthErrors.MeError,
      },
    })
  }
}

onMounted(() => {
  authorizationCallback()
})
</script>

<template>
  <div class="content">
    <div class="card">
      <p class="title">
        Завершение авторизации...
      </p>
      <Icon icon="mdi:loading" class="spinner" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 24px;

  .title {
    font-weight: 500;
    font-size: 1.5rem;
    color: var(--fg-primary-color);
  }

  .spinner {
    font-size: 2.5rem;
    color: var(--fg-accent-color);
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
