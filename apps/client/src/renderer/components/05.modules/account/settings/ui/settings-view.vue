<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { NavigationBack } from '~/components/02.shared/navigation-back/index'
import { useProfileSettings } from '../composables/use-profile-settings'

const {
  user,
  profileForm,
  passwordForm,
  deleteForm,
  isProfileChanged,
  isPasswordFormValid,
  updateProfile,
  changePassword,
  deleteAccount,
  handleAvatarUpload,
  isUpdatingProfile,
  isChangingPassword,
  isDeletingAccount,
} = useProfileSettings()

const avatarInput = ref<HTMLInputElement | null>(null)
</script>

<template>
  <div v-if="user" class="profile-page">
    <header class="profile-header">
      <NavigationBack />
      <h1>Настройки аккаунта</h1>
      <p>Здесь вы можете управлять информацией вашего аккаунта.</p>
    </header>

    <!-- Основная информация -->
    <section class="profile-section">
      <h2 class="section-title">
        Основная информация
      </h2>
      <div class="section-content info-grid">
        <div class="avatar-uploader">
          <KitAvatar :src="user.avatarUrl" :name="user.name" :size="120" />
          <input ref="avatarInput" type="file" accept="image/*" hidden @change="handleAvatarUpload">
          <KitBtn variant="outlined" color="secondary" class="upload-btn" @click="avatarInput?.click()">
            <Icon icon="mdi:camera-outline" />
            Сменить фото
          </KitBtn>
        </div>
        <div class="info-fields">
          <KitInput v-model="profileForm.name" label="Имя" icon="mdi:account-outline" />
          <KitInput v-model="profileForm.email" label="Email" icon="mdi:email-outline" disabled />
        </div>
      </div>
      <footer class="section-footer">
        <KitBtn :disabled="!isProfileChanged || isUpdatingProfile" :loading="isUpdatingProfile" @click="updateProfile()">
          Сохранить изменения
        </KitBtn>
      </footer>
    </section>

    <KitDivider />

    <!-- Безопасность -->
    <section class="profile-section">
      <h2 class="section-title">
        Безопасность
      </h2>
      <div class="section-content password-grid">
        <KitInput
          v-model="passwordForm.currentPassword"
          label="Текущий пароль"
          type="password"
          icon="mdi:lock-outline"
        />
        <KitInput
          v-model="passwordForm.newPassword"
          label="Новый пароль"
          type="password"
          icon="mdi:lock-plus-outline"
        />
        <KitInput
          v-model="passwordForm.confirmPassword"
          label="Подтвердите пароль"
          type="password"
          icon="mdi:lock-check-outline"
        />
      </div>
      <footer class="section-footer">
        <KitBtn :disabled="!isPasswordFormValid || isChangingPassword" :loading="isChangingPassword" @click="changePassword">
          Сменить пароль
        </KitBtn>
      </footer>
    </section>

    <KitDivider />

    <!-- Опасная зона -->
    <section class="profile-section danger-zone">
      <h2 class="section-title">
        Опасная зона
      </h2>
      <div class="section-content danger-content">
        <div class="danger-info">
          <h3>Удаление аккаунта</h3>
          <p>После удаления все ваши данные, включая путешествия и фотографии, будут безвозвратно утеряны.</p>
          <KitInput
            v-model="deleteForm.password"
            placeholder="Подтвердите пароль для удаления"
            type="password"
            class="danger-input"
          />
        </div>
        <KitBtn
          color="secondary"
          :disabled="!deleteForm.password || isDeletingAccount"
          :loading="isDeletingAccount"
          @click="deleteAccount"
        >
          Удалить аккаунт
        </KitBtn>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.profile-header {
  h1 {
    font-size: 2rem;
    font-weight: 700;
  }
  p {
    color: var(--fg-secondary-color);
  }
}
.profile-section {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
}
.section-title {
  font-size: 1.25rem;
  padding: 1rem 1.5rem;
  margin: 0;
  border-bottom: 1px solid var(--border-secondary-color);
}
.section-content {
  padding: 1.5rem;
}
.section-footer {
  padding: 1rem 1.5rem;
  background-color: var(--bg-tertiary-color);
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: flex-end;
}

.info-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2rem;
  align-items: flex-start;
}
.avatar-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.info-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.password-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.danger-zone {
  border-color: var(--border-error-color);
  .section-title {
    color: var(--fg-error-color);
  }
}
.danger-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}
.danger-info {
  h3 {
    margin: 0 0 0.5rem;
    color: var(--fg-primary-color);
  }
  p {
    margin: 0 0 1rem;
    color: var(--fg-secondary-color);
  }
  .danger-input {
    max-width: 300px;
  }
}

@media (max-width: 768px) {
  .info-grid,
  .danger-content {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}
</style>
