<script setup lang="ts">
import type { Trip } from '~/shared/types/models/trip'
import { useRouter } from 'vue-router'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { useModuleStore, useTripPermissions } from '~/components/05.modules/trip-info'
import { AppRoutePaths } from '~/shared/constants/routes'

interface Props {
  visible: boolean
  participants: Trip['participants']
}
defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const router = useRouter()
const tripPlanStore = useModuleStore('plan')
const { canEdit } = useTripPermissions()

const email = ref('')

function goToProfile(participantId: string) {
  router.push(AppRoutePaths.User.Profile(participantId))
  emit('update:visible', false)
}

async function handleInvite() {
  if (!email.value.trim())
    return

  await tripPlanStore.addParticipant(email.value.trim())
  email.value = ''
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Участники путешествия"
    icon="mdi:account-group-outline"
    :max-width="450"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="participants-dialog-content">
      <ul v-if="participants.length > 0" class="participants-list">
        <li v-for="p in participants" :key="p.id">
          <button
            class="participant-item"
            @click="goToProfile(p.id)"
          >
            <KitAvatar :src="p.avatarUrl" :name="p.name" :size="32" />
            <span>{{ p.name }}</span>
          </button>
        </li>
      </ul>
      <div v-else class="empty-state">
        <p>В этом путешествии пока нет участников.</p>
      </div>

      <template v-if="canEdit">
        <KitDivider />

        <div class="invite-section">
          <h4 class="section-title">
            Пригласить участника
          </h4>
          <div class="invite-form">
            <KitInput
              v-model="email"
              placeholder="Email пользователя"
              icon="mdi:email-outline"
              @keydown.enter="handleInvite"
            />
            <KitBtn
              :disabled="!email.trim() || tripPlanStore.isAddingParticipant"
              :loading="tripPlanStore.isAddingParticipant"
              @click="handleInvite"
            >
              Добавить
            </KitBtn>
          </div>
        </div>
      </template>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.participants-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.participants-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1rem;
  padding: 8px 12px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  width: 100%;
  border: 1px solid transparent;
  text-align: left;
  font-family: inherit;
  color: var(--fg-primary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-accent-color);
    background-color: var(--bg-hover-color);
  }
}

.empty-state {
  text-align: center;
  color: var(--fg-secondary-color);
  padding: 16px;
  font-size: 0.9rem;
}

.invite-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.invite-form {
  display: flex;
  gap: 8px;

  :deep(.kit-input-group) {
    flex-grow: 1;
  }
}
</style>
