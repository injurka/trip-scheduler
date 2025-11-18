<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { CommunityPrivacy } from '~/shared/types/models/community'
import { useCommunitiesHubStore } from '../../composables/use-communities-hub'

const visible = defineModel<boolean>('visible', { required: true })
const store = useCommunitiesHubStore()

const newCommunityData = ref({
  name: '',
  description: '',
  privacyType: CommunityPrivacy.PUBLIC,
})

const isFormValid = computed(() => newCommunityData.value.name.trim().length > 0)

async function handleCreate() {
  await store.createCommunity(newCommunityData.value)
  if (!store.isLoading) {
    visible.value = false
  }
}

watch(visible, (isVisible) => {
  if (!isVisible) {
    // Reset form when dialog closes
    newCommunityData.value = { name: '', description: '', privacyType: CommunityPrivacy.PUBLIC }
  }
})
</script>

<template>
  <KitDialogWithClose
    v-model:visible="visible"
    title="Создать сообщество"
    icon="mdi:plus-circle-outline"
    :max-width="500"
  >
    <form class="create-community-form" @submit.prevent="handleCreate">
      <KitInput
        v-model="newCommunityData.name"
        label="Название сообщества"
        placeholder="Например, 'Любители походов'"
        required
      />
      <KitInput
        v-model="newCommunityData.description"
        label="Описание (необязательно)"
        placeholder="Цели и тематика сообщества"
        type="textarea"
      />
      <div class="privacy-options">
        <label>Приватность</label>
        <div class="radio-group">
          <label class="radio-label">
            <input v-model="newCommunityData.privacyType" type="radio" :value="CommunityPrivacy.PUBLIC">
            <span class="radio-text">Публичное (любой может найти и вступить)</span>
          </label>
          <label class="radio-label">
            <input v-model="newCommunityData.privacyType" type="radio" :value="CommunityPrivacy.PRIVATE">
            <span class="radio-text">Приватное (вступление по приглашениям)</span>
          </label>
        </div>
      </div>
      <div class="form-actions">
        <KitBtn variant="outlined" color="secondary" @click="visible = false">
          Отмена
        </KitBtn>
        <KitBtn
          type="submit"
          :disabled="!isFormValid || store.isLoading"
          :loading="store.isLoading"
        >
          Создать
        </KitBtn>
      </div>
    </form>
  </KitDialogWithClose>
</template>

<style lang="scss" scoped>
.create-community-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.privacy-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  & > label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--r-s);

  &:hover {
    background-color: var(--bg-hover-color);
  }

  .radio-text {
    font-size: 0.9rem;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
