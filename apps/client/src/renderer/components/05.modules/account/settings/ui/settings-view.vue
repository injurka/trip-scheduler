<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Cropper } from 'vue-advanced-cropper'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { NavigationBack } from '~/components/02.shared/navigation-back/index'
import { useProfileSettings } from '../composables/use-profile-settings'
import 'vue-advanced-cropper/dist/style.css'

const {
  user,
  profileForm,
  passwordForm,
  setPasswordForm,
  deleteForm,
  isProfileChanged,
  isPasswordFormValid,
  isSetPasswordFormValid,
  updateProfile,
  changePassword,
  setPassword,
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
  isSettingPassword,
  isDeletingAccount,
  vaultPath,
  selectVaultFolder,
  isNative,
  // OAuth & Integrations
  isYandexLinked,
  isGoogleLinked,
  isGithubLinked,
  isTelegramLinked,
  hasPassword,
  unlinkingProvider,
  isTelegramModalVisible,
  isTelegramLinking,
  telegramLinkUrl,
  linkOAuth,
  startTelegramLink,
  cancelTelegramLinkModal,
  unlinkProvider,
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
      <template v-if="isNative">
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

    <!-- Секция: Связанные аккаунты -->
    <section class="profile-section">
      <h2 class="section-title">
        Связанные аккаунты
      </h2>
      <div class="section-content">
        <p class="section-description">
          Привяжите сторонние сервисы для быстрого входа в аккаунт в один клик.
        </p>

        <div class="integrations-list">
          <!-- Яндекс -->
          <div class="integration-item">
            <div class="integration-info">
              <div class="integration-icon-wrap yandex">
                <span class="yandex-badge">Я</span>
              </div>
              <div class="integration-meta">
                <h4>Яндекс</h4>
                <div class="integration-status" :class="{ linked: isYandexLinked }">
                  <span class="status-dot" />
                  <span>{{ isYandexLinked ? 'Подключен' : 'Не привязан' }}</span>
                </div>
              </div>
            </div>
            <div class="integration-action">
              <KitBtn
                v-if="isYandexLinked"
                variant="outlined"
                color="secondary"
                size="sm"
                :disabled="unlinkingProvider === 'yandex'"
                :loading="unlinkingProvider === 'yandex'"
                @click="unlinkProvider('yandex')"
              >
                Отвязать
              </KitBtn>
              <KitBtn
                v-else
                variant="solid"
                color="secondary"
                size="sm"
                @click="linkOAuth('yandex')"
              >
                Привязать
              </KitBtn>
            </div>
          </div>

          <!-- Telegram -->
          <div class="integration-item">
            <div class="integration-info">
              <div class="integration-icon-wrap telegram">
                <Icon icon="mdi:telegram" />
              </div>
              <div class="integration-meta">
                <h4>Telegram</h4>
                <div class="integration-status" :class="{ linked: isTelegramLinked }">
                  <span class="status-dot" />
                  <span>{{ isTelegramLinked ? 'Подключен' : 'Не привязан' }}</span>
                </div>
              </div>
            </div>
            <div class="integration-action">
              <KitBtn
                v-if="isTelegramLinked"
                variant="outlined"
                color="secondary"
                size="sm"
                :disabled="unlinkingProvider === 'telegram'"
                :loading="unlinkingProvider === 'telegram'"
                @click="unlinkProvider('telegram')"
              >
                Отвязать
              </KitBtn>
              <KitBtn
                v-else
                variant="solid"
                color="secondary"
                size="sm"
                :loading="isTelegramLinking"
                @click="startTelegramLink"
              >
                Привязать
              </KitBtn>
            </div>
          </div>

          <!-- Google -->
          <div v-if="false" class="integration-item">
            <div class="integration-info">
              <div class="integration-icon-wrap google">
                <Icon icon="mdi:google" />
              </div>
              <div class="integration-meta">
                <h4>Google</h4>
                <div class="integration-status" :class="{ linked: isGoogleLinked }">
                  <span class="status-dot" />
                  <span>{{ isGoogleLinked ? 'Подключен' : 'Не привязан' }}</span>
                </div>
              </div>
            </div>
            <div class="integration-action">
              <KitBtn
                v-if="isGoogleLinked"
                variant="outlined"
                color="secondary"
                size="sm"
                :disabled="unlinkingProvider === 'google'"
                :loading="unlinkingProvider === 'google'"
                @click="unlinkProvider('google')"
              >
                Отвязать
              </KitBtn>
              <KitBtn
                v-else
                variant="solid"
                color="secondary"
                size="sm"
                @click="linkOAuth('google')"
              >
                Привязать
              </KitBtn>
            </div>
          </div>

          <!-- GitHub -->
          <div v-if="false" class="integration-item">
            <div class="integration-info">
              <div class="integration-icon-wrap github">
                <Icon icon="mdi:github" />
              </div>
              <div class="integration-meta">
                <h4>GitHub</h4>
                <div class="integration-status" :class="{ linked: isGithubLinked }">
                  <span class="status-dot" />
                  <span>{{ isGithubLinked ? 'Подключен' : 'Не привязан' }}</span>
                </div>
              </div>
            </div>
            <div class="integration-action">
              <KitBtn
                v-if="isGithubLinked"
                variant="outlined"
                color="secondary"
                size="sm"
                :disabled="unlinkingProvider === 'github'"
                :loading="unlinkingProvider === 'github'"
                @click="unlinkProvider('github')"
              >
                Отвязать
              </KitBtn>
              <KitBtn
                v-else
                variant="solid"
                color="secondary"
                size="sm"
                @click="linkOAuth('github')"
              >
                Привязать
              </KitBtn>
            </div>
          </div>
        </div>
      </div>
    </section>

    <KitDivider />

    <section class="profile-section">
      <h2 class="section-title">
        Безопасность
      </h2>
      <div v-if="hasPassword" class="section-content password-grid">
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
      <div v-else class="section-content">
        <p class="password-note">
          Вы вошли через социальную сеть, и пароль для аккаунта еще не установлен. Задайте пароль, чтобы иметь возможность входить по email и паролю.
        </p>
        <div class="password-grid">
          <KitInput
            v-model="setPasswordForm.newPassword"
            label="Новый пароль"
            type="password"
            icon="mdi:lock-plus-outline"
          />
          <KitInput
            v-model="setPasswordForm.confirmPassword"
            label="Подтвердите пароль"
            type="password"
            icon="mdi:lock-check-outline"
          />
        </div>
      </div>
      <footer class="section-footer">
        <KitBtn
          v-if="hasPassword"
          size="sm"
          :disabled="!isPasswordFormValid || isChangingPassword"
          :loading="isChangingPassword"
          @click="changePassword"
        >
          Сменить пароль
        </KitBtn>
        <KitBtn
          v-else
          size="sm"
          :disabled="!isSetPasswordFormValid || isSettingPassword"
          :loading="isSettingPassword"
          @click="setPassword"
        >
          Установить пароль
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

    <!-- Диалог привязки Telegram -->
    <KitDialogWithClose
      :visible="isTelegramModalVisible"
      title="Привязка Telegram"
      icon="mdi:telegram"
      :max-width="480"
      @update:visible="cancelTelegramLinkModal"
    >
      <div class="telegram-link-body">
        <p class="telegram-desc">
          Чтобы привязать Telegram к вашему аккаунту:
        </p>
        <ol class="telegram-steps">
          <li>Нажмите кнопку ниже, чтобы открыть бота в Telegram</li>
          <li>В чате с ботом нажмите <strong>«Старт»</strong></li>
          <li>Подтвердите привязку аккаунта кнопкой <strong>«Привязать»</strong></li>
        </ol>
        <div class="telegram-action">
          <a :href="telegramLinkUrl" target="_blank" class="telegram-btn-link" rel="noopener noreferrer">
            <KitBtn color="primary" size="md">
              <Icon icon="mdi:telegram" />
              Открыть бота в Telegram
            </KitBtn>
          </a>
        </div>
        <div class="telegram-waiting">
          <Icon icon="mdi:loading" class="spinner" />
          <span>Ожидание подтверждения в Telegram...</span>
        </div>
      </div>
    </KitDialogWithClose>

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

.section-description {
  margin: 0 0 1.25rem;
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
}

.integrations-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.integration-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  gap: 1rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.integration-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.integration-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: var(--r-m);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 1.5rem;
  flex-shrink: 0;

  &.yandex {
    color: #fc3f1d;
  }
  &.telegram {
    color: #229ed9;
  }
  &.google {
    color: #ea4335;
  }
  &.github {
    color: var(--fg-primary-color);
  }
}

.yandex-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fc3f1d;
  color: #ffffff;
  font-family:
    Arial,
    -apple-system,
    sans-serif;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1;
}

.integration-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.integration-status {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: var(--fg-secondary-color);

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  &.linked {
    color: #22c55e;
    .status-dot {
      background-color: #22c55e;
    }
  }
}

.telegram-link-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;

  .telegram-desc {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
  }

  .telegram-steps {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--fg-primary-color);

    li strong {
      color: var(--fg-accent-color);
    }
  }

  .telegram-action {
    display: flex;
    justify-content: center;
    margin: 0.5rem 0;

    .telegram-btn-link {
      text-decoration: none;
    }
  }

  .telegram-waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: var(--bg-tertiary-color);
    border-radius: var(--r-s);
    font-size: 0.875rem;
    color: var(--fg-secondary-color);

    .spinner {
      font-size: 1.25rem;
      color: var(--fg-accent-color);
      animation: spin 1s linear infinite;
    }
  }
}

.password-note {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
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
