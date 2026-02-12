<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AppRoutePaths } from '~/shared/constants/routes'

const router = useRouter()
const route = useRoute()

function goToSignIn() {
  router.push({
    path: AppRoutePaths.Auth.SignIn,
    query: { returnUrl: route.fullPath },
  })
}
</script>

<template>
  <div class="unauthorized-state">
    <Icon icon="mdi:lock-outline" class="lock-icon" />
    <h3 class="title">
      Доступно только для авторизованных
    </h3>
    <p class="message">
      Войдите в систему, чтобы создавать и просматривать свои путешествия.
    </p>
    <KitBtn @click="goToSignIn">
      <Icon icon="mdi:login" />
      Войти
    </KitBtn>
  </div>
</template>

<style scoped lang="scss">
.unauthorized-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--fg-secondary-color);
  width: 100%;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  margin-top: 16px;
  background-color: var(--bg-secondary-color);
}

.lock-icon {
  font-size: 4rem;
  margin-bottom: 16px;
  color: var(--fg-tertiary-color);
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0 0 8px;
}

.message {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  margin: 0 0 24px;
  max-width: 400px;
  line-height: 1.5;
}
</style>
