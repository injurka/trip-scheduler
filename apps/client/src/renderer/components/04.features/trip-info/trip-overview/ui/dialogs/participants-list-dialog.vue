<script setup lang="ts">
import type { Trip } from '~/shared/types/models/trip'
import { useRouter } from 'vue-router'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { AppRouteNames } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

interface Props {
  visible: boolean
  participants: Trip['participants']
}
defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const authStore = useAuthStore()
const router = useRouter()

function goToProfile(participantId: string) {
  // Навигация работает только для профиля текущего пользователя,
  // так как в проекте нет динамических роутов для чужих профилей.
  if (authStore.user?.id === participantId) {
    router.push({ name: AppRouteNames.AccountProfile })
    emit('update:visible', false)
  }
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Участники путешествия"
    icon="mdi:account-group-outline"
    :max-width="400"
    @update:visible="emit('update:visible', $event)"
  >
    <ul class="simple-list">
      <li v-for="p in participants" :key="p.id">
        <button
          class="participant-item"
          :disabled="authStore.user?.id !== p.id"
          @click="goToProfile(p.id)"
        >
          <KitAvatar :src="p.avatarUrl" :name="p.name" :size="32" />
          <span>{{ p.name }}</span>
        </button>
      </li>
    </ul>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.simple-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1rem;
  padding: 0.5rem;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  width: 100%;
  border: 1px solid transparent;
  text-align: left;
  font-family: inherit;
  color: var(--fg-primary-color);

  &:not(:disabled) {
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--border-accent-color);
      background-color: var(--bg-hover-color);
    }
  }

  &:disabled {
    cursor: default;
  }
}
</style>
