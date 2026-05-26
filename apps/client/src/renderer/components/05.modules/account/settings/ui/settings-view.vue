<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Cropper } from 'vue-advanced-cropper'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { NavigationBack } from '~/components/02.shared/navigation-back/index'
import { useProfileSettings } from '../composables/use-profile-settings'
import 'vue-advanced-cropper/dist/style.css'

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
  handleCoverSelect,
  cancelCrop,
  saveCroppedImage,
  coverFile,
  coverPreviewUrl,
  isPreviewVisible,
  tempCoverUrl,
  isCropperVisible,
  isUpdatingProfile,
  isChangingPassword,
  isDeletingAccount,
  vaultPath,
  selectVaultFolder,
  isElectron,
} = useProfileSettings()

const avatarInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

// Генерируем стиль для блочного превью обложки
const previewHeaderStyle = computed(() => {
  const targetCoverUrl = coverPreviewUrl.value || (user.value as any)?.coverUrl
  if (targetCoverUrl) {
    return {
      backgroundImage: `linear-gradient(to top, var(--bg-secondary-color) 10%, transparent 80%), url(${targetCoverUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return {}
})

function applyCrop() {
  if (cropperRef.value) {
    const { canvas } = cropperRef.value.getResult()
    if (canvas) {
      saveCroppedImage(canvas)
    }
  }
}
</script>

<template>
  <div v-if="user" class="profile-page">
    <header class="profile-header">
      <NavigationBack />
      <h1>Настройки аккаунта</h1>
      <p>Здесь вы можете управлять информацией вашего аккаунта.</p>
    </header>

    <section class="profile-section">
      <template v-if="isElectron">
        <h2 class="section-title">
          Папка для медиафайлов
        </h2>
        <div class="section-content">
          <p>Выберите папку на вашем устройстве, куда будут сохраняться фотографии для оффлайн-доступа. Это позволит просматривать их без интернета и быстрее загружать.</p>

          <div class="vault-control">
            <KitInput
              :model-value="vaultPath || 'Не выбрано'"
              readonly
              label="Текущая папка"
              icon="mdi:folder-outline"
            />
            <KitBtn @click="selectVaultFolder">
              {{ vaultPath ? 'Изменить' : 'Выбрать папку' }}
            </KitBtn>
          </div>
        </div>
      </template>

      <h2 class="section-title">
        Основная информация
      </h2>
      <div class="section-content">
        <div class="info-grid">
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

        <KitDivider class="divider-spaced" />

        <!-- Настройки обложки -->
        <div class="cover-uploader-section">
          <div class="cover-info">
            <h3>Обложка профиля</h3>
            <p>Установите изображение, которое будет отображаться в шапке вашего профиля. Лучше использовать горизонтальные фото.</p>
            <div class="cover-actions">
              <input ref="coverInput" type="file" accept="image/*" hidden @change="handleCoverSelect">
              <KitBtn variant="outlined" color="secondary" @click="coverInput?.click()">
                <Icon icon="mdi:image-outline" />
                {{ coverFile ? 'Выбрать другую обложку' : 'Загрузить обложку' }}
              </KitBtn>
              <KitBtn
                v-if="coverPreviewUrl || (user as any).coverUrl"
                variant="subtle"
                color="secondary"
                @click="isPreviewVisible = !isPreviewVisible"
              >
                <Icon :icon="isPreviewVisible ? 'mdi:eye-off-outline' : 'mdi:eye-outline'" />
                {{ isPreviewVisible ? 'Скрыть превью' : 'Предпросмотр' }}
              </KitBtn>
            </div>
          </div>
        </div>

        <!-- Блок Предпросмотра -->
        <div v-if="isPreviewVisible" class="preview-wrapper">
          <div class="profile-header-mock" :style="previewHeaderStyle">
            <div class="avatar-section">
              <KitAvatar :src="user.avatarUrl" :name="profileForm.name || user.name" :size="100" class="profile-avatar" />
            </div>
            <div class="info-section-mock">
              <h1 class="user-name">
                {{ profileForm.name || user.name }}
              </h1>
              <p class="user-bio">
                Путешественник и исследователь. В поисках новых горизонтов и незабываемых впечатлений.
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer class="section-footer">
        <KitBtn size="sm" :disabled="!isProfileChanged || isUpdatingProfile" :loading="isUpdatingProfile" @click="updateProfile()">
          Сохранить изменения
        </KitBtn>
      </footer>
    </section>

    <KitDivider />

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
        <KitBtn size="sm" :disabled="!isPasswordFormValid || isChangingPassword" :loading="isChangingPassword" @click="changePassword">
          Сменить пароль
        </KitBtn>
      </footer>
    </section>

    <KitDivider />

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
          size="sm"
          color="secondary"
          :disabled="!deleteForm.password || isDeletingAccount"
          :loading="isDeletingAccount"
          @click="deleteAccount"
        >
          Удалить аккаунт
        </KitBtn>
      </div>
    </section>

    <!-- Модальное окно для обрезки (кроппер) -->
    <Teleport to="body">
      <div v-if="isCropperVisible" class="cropper-overlay">
        <div class="cropper-modal">
          <div class="cropper-header">
            <h3>Кадрирование обложки</h3>
            <button class="close-btn" @click="cancelCrop">
              <Icon icon="mdi:close" width="24" />
            </button>
          </div>

          <div class="cropper-body">
            <!-- Пропорция 3:1 для шапки (примерно соответствует пропорциям profile-header-mock) -->
            <Cropper
              ref="cropperRef"
              class="advanced-cropper"
              :src="tempCoverUrl"
              :stencil-props="{
                aspectRatio: 3 / 1,
              }"
              image-restriction="stencil"
            />
          </div>

          <div class="cropper-footer">
            <KitBtn variant="outlined" color="secondary" @click="cancelCrop">
              Отмена
            </KitBtn>
            <KitBtn color="primary" @click="applyCrop">
              Применить
            </KitBtn>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding-bottom: 4rem;
}

.vault-control {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}
.vault-control .kit-input-group {
  flex-grow: 1;
}

.profile-header {
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: var(--fg-primary-color);
    line-height: 1.2;
  }
  p {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
    max-width: 600px;
    line-height: 1.5;
  }

  @include media-down(sm) {
    h1 {
      font-size: 2rem;
    }
    p {
      font-size: 1rem;
    }
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

.divider-spaced {
  margin: 2rem 0;
}

.cover-uploader-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  h3 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    color: var(--fg-primary-color);
  }
  p {
    margin: 0 0 1rem;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
  }

  .cover-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
}

.preview-wrapper {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  background-color: var(--bg-tertiary-color);
}

.profile-header-mock {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  width: 100%;
  min-height: 200px;
  padding: 0 1.5rem 1.5rem;
  border-radius: var(--r-m);
  background-image: linear-gradient(to right, var(--bg-tertiary-color), var(--bg-secondary-color));
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;

  .avatar-section {
    z-index: 2;
    .profile-avatar {
      border: 4px solid var(--bg-primary-color);
    }
  }

  .info-section-mock {
    flex-grow: 1;
    z-index: 2;

    .user-name {
      margin: 0 0 0.25rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--fg-primary-color);
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }

    .user-bio {
      max-width: 400px;
      font-size: 0.85rem;
      color: var(--fg-tertiary-color);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
  }
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

/* Стили для кроппера */
.cropper-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
}

.cropper-modal {
  background: var(--bg-secondary-color);
  border-radius: var(--r-l);
  width: 100%;
  max-width: 800px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);

  .cropper-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-secondary-color);

    h3 {
      margin: 0;
      font-size: 1.2rem;
      color: var(--fg-primary-color);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--fg-secondary-color);
      cursor: pointer;
      display: flex;
      padding: 4px;

      &:hover {
        color: var(--fg-primary-color);
      }
    }
  }

  .cropper-body {
    background: #000;
    height: 400px;

    .advanced-cropper {
      height: 100%;
      width: 100%;
    }
  }

  .cropper-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-secondary-color);
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

  .profile-header-mock {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: 2rem;
  }

  .cropper-overlay {
    padding: 0;
  }

  .cropper-modal {
    height: 100vh;
    border-radius: 0;
    justify-content: space-between;

    .cropper-body {
      flex-grow: 1;
      height: auto;
    }
  }
}
</style>
