<script setup lang="ts">
import type { Trip } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { useModuleStore, useTripPermissions } from '~/components/05.modules/trip-info'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { AppRoutePaths } from '~/shared/constants/routes'

interface Props {
  visible: boolean
  participants: Trip['participants']
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const router = useRouter()
const tripPlanStore = useModuleStore('plan')
const { canEdit } = useTripPermissions()

const searchQuery = ref('')
const searchResults = ref<any[]>([])

const SEARCH_USERS_KEY = 'users:search'
const isSearching = useRequestStatus(SEARCH_USERS_KEY)

function goToProfile(participantId: string) {
  router.push(AppRoutePaths.User.Profile(participantId))
  emit('update:visible', false)
}

const performSearch = useDebounceFn(() => {
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchResults.value = []
    return
  }

  useRequest({
    key: SEARCH_USERS_KEY,
    fn: db => db.user.search(q),
    onSuccess: (data) => {
      searchResults.value = data || []
    },
    onError: ({ error }) => {
      console.error('Ошибка поиска', error)
      searchResults.value = []
    },
  })
}, 500)

function isAlreadyAdded(userId: string) {
  return props.participants.some(p => p.id === userId)
}

async function handleAdd(userId: string) {
  await tripPlanStore.addParticipant(userId)
  searchQuery.value = ''
  searchResults.value = []
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
            <div class="user-details">
              <span class="user-name">{{ p.name }}</span>
            </div>
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
              v-model="searchQuery"
              placeholder="Имя или Email пользователя"
              icon="mdi:magnify"
              @input="performSearch"
            />
          </div>

          <div v-if="isSearching" class="search-status">
            <Icon icon="mdi:loading" class="spin" /> Поиск...
          </div>

          <ul v-else-if="searchResults.length > 0" class="search-results">
            <li v-for="user in searchResults" :key="user.id" class="search-item">
              <div class="user-info">
                <KitAvatar :src="user.avatarUrl" :name="user.name" :size="32" />
                <div class="user-details">
                  <span class="user-name">{{ user.name }}</span>
                  <span v-if="user.email" class="user-email">{{ user.email }}</span>
                </div>
              </div>
              <KitBtn
                size="sm"
                variant="text"
                icon="mdi:plus"
                :disabled="isAlreadyAdded(user.id) || tripPlanStore.isAddingParticipant"
                @click="handleAdd(user.id)"
              />
            </li>
          </ul>

          <div v-else-if="searchQuery.trim().length >= 2" class="search-status">
            Ничего не найдено
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
  max-height: 200px;
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

  :deep(.kit-input-group) {
    flex-grow: 1;
  }
}

.search-results {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
}

.search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  transition: background-color 0.2s ease;
  border: 1px solid transparent;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;

  .user-name {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-email {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.search-status {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  text-align: center;
  padding: 1rem 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;

  .spin {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
