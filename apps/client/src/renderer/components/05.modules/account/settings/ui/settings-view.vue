<script setup lang="ts">
import type { TabItem } from '~/components/01.kit/kit-tabs'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { CustomTileSettingsDialog } from '~/components/02.shared/custom-tile-settings-dialog'
import { NavigationBack } from '~/components/02.shared/navigation-back/index'
import { resolveApiUrl } from '~/shared/lib/url'
import { useAppSettingsStore } from '~/shared/store/app-settings.store'
import { useProfileSettings } from '../composables/use-profile-settings'
import 'vue-advanced-cropper/dist/style.css'

const route = useRoute()
const router = useRouter()
const appSettingsStore = useAppSettingsStore()
const isCustomTileModalOpen = ref(false)

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
  coverPreviewUrl,
  hasCover,
  tempCoverUrl,
  isCropperVisible,
  isUpdatingProfile,
  isChangingPassword,
  isSettingPassword,
  isDeletingAccount,
  vaultPath,
  selectVaultFolder,
  isNative,
  isMobileApp,
  enableEruda,
  isCheckingUpdate,
  checkManualUpdate,
  appVersion,
  // OAuth & Integrations
  isYandexLinked,
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

const activeTab = computed({
  get: () => (route.query.tab as string) || 'profile',
  set: (val: string) => {
    router.replace({ query: { ...route.query, tab: val } })
  },
})

const tabItems = computed<TabItem[]>(() => {
  const items: TabItem[] = [
    {
      id: 'profile',
      label: 'Профиль',
      icon: 'mdi:account-outline',
    },
    {
      id: 'integrations',
      label: 'Интеграции',
      icon: 'mdi:link-variant',
    },
    {
      id: 'security',
      label: 'Безопасность',
      icon: 'mdi:shield-lock-outline',
    },
  ]

  if (isNative) {
    items.push({
      id: 'system',
      label: 'Система',
      icon: 'mdi:cog-outline',
    })
  }

  items.push({
    id: 'danger',
    label: 'Опасная зона',
    icon: 'mdi:alert-circle-outline',
  })

  return items
})

// Генерируем стиль для интерактивного превью обложки
const previewHeaderStyle = computed(() => {
  const targetCoverUrl = coverPreviewUrl.value || resolveApiUrl((user.value as any)?.coverUrl)
  if (targetCoverUrl) {
    return {
      backgroundImage: `linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.2) 60%, rgba(0, 0, 0, 0.4) 100%), url(${targetCoverUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return {
    backgroundImage: `linear-gradient(135deg, var(--bg-tertiary-color) 0%, var(--bg-secondary-color) 100%)`,
  }
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
    <header class="settings-header">
      <NavigationBack />
      <div class="header-titles">
        <h1 class="page-title">
          Настройки аккаунта
        </h1>
        <p class="page-subtitle">
          Управление личными данными, безопасностью и подключенными сервисами
        </p>
      </div>
    </header>

    <div class="settings-tabs-wrapper">
      <KitTabs v-model="activeTab" :items="tabItems">
        <!-- Вкладка 1: Профиль -->
        <template #profile>
          <div class="settings-card">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">
                  Личные данные
                </h2>
                <p class="card-subtitle">
                  Внешний вид вашей страницы и контактная информация
                </p>
              </div>
            </div>

            <!-- Интерактивная витрина профиля (обложка + аватар) -->
            <div class="profile-banner-showcase">
              <div class="cover-canvas" :style="previewHeaderStyle">
                <input ref="coverInput" type="file" accept="image/*" hidden @change="handleCoverSelect">
                <button
                  type="button"
                  class="cover-action-badge"
                  @click="coverInput?.click()"
                >
                  <Icon icon="mdi:camera" class="badge-icon" />
                  <span>{{ hasCover ? 'Сменить обложку' : 'Загрузить обложку' }}</span>
                </button>
              </div>

              <div class="avatar-overlap-wrapper">
                <div class="avatar-interactive-container">
                  <KitAvatar
                    :src="user.avatarUrl"
                    :name="profileForm.name || user.name"
                    :size="96"
                    class="banner-avatar"
                  />
                  <input ref="avatarInput" type="file" accept="image/*" hidden @change="handleAvatarUpload">
                  <button
                    type="button"
                    class="avatar-action-btn"
                    title="Изменить фото профиля"
                    aria-label="Изменить фото профиля"
                    @click="avatarInput?.click()"
                  >
                    <Icon icon="mdi:camera-outline" />
                  </button>
                </div>

                <div class="user-quick-info">
                  <h3 class="user-display-name">
                    {{ profileForm.name || user.name }}
                  </h3>
                  <span class="user-display-email">{{ user.email }}</span>
                </div>
              </div>
            </div>

            <div class="card-body">
              <div class="form-grid">
                <div class="form-field">
                  <KitInput
                    v-model="profileForm.name"
                    label="Отображаемое имя"
                    placeholder="Как к вам обращаться"
                    icon="mdi:account-outline"
                  />
                </div>

                <div class="form-field">
                  <KitInput
                    v-model="profileForm.email"
                    label="Электронная почта"
                    icon="mdi:email-outline"
                    disabled
                  />
                  <span class="field-hint">Email используется для входа и подтверждений</span>
                </div>
              </div>
            </div>

            <div class="card-footer">
              <div class="save-status">
                <span v-if="isProfileChanged" class="changed-indicator">
                  <Icon icon="mdi:circle-medium" /> Есть несохраненные изменения
                </span>
              </div>
              <KitBtn
                size="md"
                color="primary"
                :disabled="!isProfileChanged || isUpdatingProfile"
                :loading="isUpdatingProfile"
                icon="mdi:content-save-outline"
                @click="updateProfile()"
              >
                Сохранить изменения
              </KitBtn>
            </div>
          </div>
        </template>

        <!-- Вкладка 2: Интеграции -->
        <template #integrations>
          <div class="settings-card">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">
                  Связанные аккаунты
                </h2>
                <p class="card-subtitle">
                  Подключите сторонние сервисы для быстрого входа в один клик без ввода пароля
                </p>
              </div>
            </div>

            <div class="card-body">
              <div class="integrations-grid">
                <!-- Яндекс -->
                <div class="integration-tile" :class="{ 'is-active': isYandexLinked }">
                  <div class="tile-leading">
                    <div class="provider-icon-wrapper yandex">
                      <span class="yandex-glyph">Я</span>
                    </div>
                    <div class="tile-meta">
                      <div class="provider-title">
                        Яндекс ID
                      </div>
                      <div class="provider-status-badge" :class="{ linked: isYandexLinked }">
                        <Icon :icon="isYandexLinked ? 'mdi:check-circle' : 'mdi:link-variant-off'" class="status-icon" />
                        <span>{{ isYandexLinked ? 'Подключен' : 'Не привязан' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="tile-trailing">
                    <KitBtn
                      v-if="isYandexLinked"
                      variant="outlined"
                      color="secondary"
                      size="sm"
                      :disabled="unlinkingProvider === 'yandex'"
                      :loading="unlinkingProvider === 'yandex'"
                      icon="mdi:link-variant-off"
                      @click="unlinkProvider('yandex')"
                    >
                      Отвязать
                    </KitBtn>
                    <KitBtn
                      v-else
                      variant="solid"
                      color="secondary"
                      size="sm"
                      icon="mdi:plus"
                      @click="linkOAuth('yandex')"
                    >
                      Привязать
                    </KitBtn>
                  </div>
                </div>

                <!-- Telegram -->
                <div class="integration-tile" :class="{ 'is-active': isTelegramLinked }">
                  <div class="tile-leading">
                    <div class="provider-icon-wrapper telegram">
                      <Icon icon="mdi:telegram" />
                    </div>
                    <div class="tile-meta">
                      <div class="provider-title">
                        Telegram
                      </div>
                      <div class="provider-status-badge" :class="{ linked: isTelegramLinked }">
                        <Icon :icon="isTelegramLinked ? 'mdi:check-circle' : 'mdi:link-variant-off'" class="status-icon" />
                        <span>{{ isTelegramLinked ? 'Подключен' : 'Не привязан' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="tile-trailing">
                    <KitBtn
                      v-if="isTelegramLinked"
                      variant="outlined"
                      color="secondary"
                      size="sm"
                      :disabled="unlinkingProvider === 'telegram'"
                      :loading="unlinkingProvider === 'telegram'"
                      icon="mdi:link-variant-off"
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
                      icon="mdi:plus"
                      @click="startTelegramLink"
                    >
                      Привязать
                    </KitBtn>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Картография и источники тайлов -->
          <div class="settings-card" style="margin-top: 24px;">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">
                  Картография и источники тайлов
                </h2>
                <p class="card-subtitle">
                  Персональный API-ключ MapTiler и собственные растровые / векторные тайлы
                </p>
              </div>
              <KitBtn
                variant="outlined"
                color="primary"
                size="sm"
                icon="mdi:cog-outline"
                @click="isCustomTileModalOpen = true"
              >
                Настроить тайлы
              </KitBtn>
            </div>

            <div class="card-body">
              <div class="integrations-grid">
                <!-- MapTiler Key -->
                <div class="integration-tile" :class="{ 'is-active': !!appSettingsStore.customMapTilerKey }">
                  <div class="tile-leading">
                    <div class="provider-icon-wrapper" style="background: rgba(var(--fg-accent-color-rgb), 0.1); color: var(--fg-accent-color); display: flex; align-items: center; justify-content: center;">
                      <Icon icon="mdi:key-outline" />
                    </div>
                    <div class="tile-meta">
                      <div class="provider-title">
                        MapTiler API Key
                      </div>
                      <div class="provider-status-badge" :class="{ linked: !!appSettingsStore.customMapTilerKey }">
                        <Icon :icon="appSettingsStore.customMapTilerKey ? 'mdi:check-circle' : 'mdi:information-outline'" class="status-icon" />
                        <span>{{ appSettingsStore.customMapTilerKey ? 'Персональный ключ активен' : 'Используется системный ключ' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="tile-trailing">
                    <KitBtn
                      variant="outlined"
                      color="secondary"
                      size="sm"
                      icon="mdi:pencil-outline"
                      @click="isCustomTileModalOpen = true"
                    >
                      {{ appSettingsStore.customMapTilerKey ? 'Изменить' : 'Добавить' }}
                    </KitBtn>
                  </div>
                </div>

                <!-- Custom Tile Source -->
                <div class="integration-tile" :class="{ 'is-active': !!appSettingsStore.customTileUrl }">
                  <div class="tile-leading">
                    <div class="provider-icon-wrapper" style="background: rgba(var(--fg-accent-color-rgb), 0.1); color: var(--fg-accent-color); display: flex; align-items: center; justify-content: center;">
                      <Icon icon="mdi:map-plus" />
                    </div>
                    <div class="tile-meta">
                      <div class="provider-title">
                        {{ appSettingsStore.customTileName || 'Свои тайлы' }}
                      </div>
                      <div class="provider-status-badge" :class="{ linked: !!appSettingsStore.customTileUrl }">
                        <Icon :icon="appSettingsStore.customTileUrl ? 'mdi:check-circle' : 'mdi:link-variant-off'" class="status-icon" />
                        <span>{{ appSettingsStore.customTileUrl ? 'Источник подключен' : 'Не настроен' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="tile-trailing">
                    <KitBtn
                      variant="outlined"
                      color="secondary"
                      size="sm"
                      icon="mdi:pencil-outline"
                      @click="isCustomTileModalOpen = true"
                    >
                      {{ appSettingsStore.customTileUrl ? 'Изменить' : 'Подключить' }}
                    </KitBtn>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CustomTileSettingsDialog v-model="isCustomTileModalOpen" />
        </template>

        <!-- Вкладка 3: Безопасность -->
        <template #security>
          <div class="settings-card">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">
                  Безопасность и пароль
                </h2>
                <p class="card-subtitle">
                  Управление паролем для защиты вашего аккаунта
                </p>
              </div>
              <div class="security-status-indicator" :class="{ secure: hasPassword }">
                <Icon :icon="hasPassword ? 'mdi:shield-check' : 'mdi:shield-alert'" />
                <span>{{ hasPassword ? 'Защищен паролем' : 'Пароль не установлен' }}</span>
              </div>
            </div>

            <div class="card-body">
              <!-- Смена пароля -->
              <div v-if="hasPassword" class="password-form-section">
                <div class="password-fields-grid">
                  <div class="form-field full-row">
                    <KitInput
                      v-model="passwordForm.currentPassword"
                      label="Текущий пароль"
                      type="password"
                      placeholder="Введите текущий пароль"
                      icon="mdi:lock-outline"
                    />
                  </div>
                  <div class="form-field">
                    <KitInput
                      v-model="passwordForm.newPassword"
                      label="Новый пароль"
                      type="password"
                      placeholder="Не менее 6 символов"
                      icon="mdi:lock-plus-outline"
                    />
                  </div>
                  <div class="form-field">
                    <KitInput
                      v-model="passwordForm.confirmPassword"
                      label="Подтверждение нового пароля"
                      type="password"
                      placeholder="Повторите новый пароль"
                      icon="mdi:lock-check-outline"
                    />
                  </div>
                </div>
              </div>

              <!-- Установка пароля для OAuth пользователей -->
              <div v-else class="set-password-section">
                <div class="security-callout">
                  <Icon icon="mdi:information-outline" class="callout-icon" />
                  <div class="callout-text">
                    <strong>Вход через социальные сети</strong>
                    <p>Вы вошли через сторонний сервис. Задайте пароль, чтобы иметь возможность авторизоваться по email и паролю.</p>
                  </div>
                </div>

                <div class="password-fields-grid">
                  <div class="form-field">
                    <KitInput
                      v-model="setPasswordForm.newPassword"
                      label="Новый пароль"
                      type="password"
                      placeholder="Не менее 6 символов"
                      icon="mdi:lock-plus-outline"
                    />
                  </div>
                  <div class="form-field">
                    <KitInput
                      v-model="setPasswordForm.confirmPassword"
                      label="Подтверждение пароля"
                      type="password"
                      placeholder="Повторите пароль"
                      icon="mdi:lock-check-outline"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="card-footer">
              <div style="flex-grow: 1" />
              <KitBtn
                v-if="hasPassword"
                size="md"
                color="primary"
                :disabled="!isPasswordFormValid || isChangingPassword"
                :loading="isChangingPassword"
                icon="mdi:key-change"
                @click="changePassword"
              >
                Обновить пароль
              </KitBtn>
              <KitBtn
                v-else
                size="md"
                color="primary"
                :disabled="!isSetPasswordFormValid || isSettingPassword"
                :loading="isSettingPassword"
                icon="mdi:lock-plus"
                @click="setPassword"
              >
                Установить пароль
              </KitBtn>
            </div>
          </div>
        </template>

        <!-- Вкладка 4: Система (только Native) -->
        <template v-if="isNative" #system>
          <div class="settings-card">
            <div class="card-header">
              <div class="card-title-group">
                <h2 class="card-title">
                  Системные настройки
                </h2>
                <p class="card-subtitle">
                  Параметры локального приложения и оффлайн-хранилища
                </p>
              </div>
            </div>

            <div class="card-body system-settings-body">
              <!-- Папка для медиафайлов -->
              <div class="system-block">
                <div class="system-block-info">
                  <div class="block-icon">
                    <Icon icon="mdi:folder-image" />
                  </div>
                  <div class="block-details">
                    <div class="block-title">
                      Оффлайн-хранилище медиафайлов
                    </div>
                    <div class="block-desc">
                      {{ isMobileApp
                        ? 'Локальное хранилище для кэширования фотографий и маршрутов во внутренней памяти устройства. Позволяет просматривать воспоминания без подключения к сети.'
                        : 'Локальная папка для кэширования фотографий и маршрутов. Позволяет просматривать воспоминания без подключения к сети.'
                      }}
                    </div>
                  </div>
                </div>

                <div class="vault-picker-row">
                  <div class="vault-path-box">
                    <Icon :icon="isMobileApp ? 'mdi:cellphone-check' : 'mdi:folder-outline'" class="path-icon" />
                    <span class="path-text">{{ isMobileApp ? 'Внутренняя память приложения' : (vaultPath || 'Папка не выбрана') }}</span>
                  </div>
                  <KitBtn
                    v-if="!isMobileApp"
                    variant="outlined"
                    color="secondary"
                    size="md"
                    icon="mdi:folder-open-outline"
                    @click="selectVaultFolder"
                  >
                    {{ vaultPath ? 'Изменить папку' : 'Выбрать папку' }}
                  </KitBtn>
                </div>
              </div>

              <KitDivider />

              <!-- Консоль разработчика (Eruda для мобильного приложения) -->
              <div v-if="isMobileApp" class="system-block">
                <div class="system-block-info">
                  <div class="block-icon">
                    <Icon icon="mdi:console" />
                  </div>
                  <div class="block-details">
                    <div class="block-title">
                      Консоль разработчика
                    </div>
                    <div class="block-desc">
                      Включение мобильной панели отладки Eruda для просмотра сетевых запросов и логов.
                    </div>
                  </div>
                </div>

                <div class="developer-tools-row">
                  <KitCheckbox v-model="enableEruda">
                    Включить Eruda DevTools
                  </KitCheckbox>
                </div>
              </div>

              <KitDivider v-if="isMobileApp" />

              <!-- О приложении -->
              <div class="system-block">
                <div class="system-block-info">
                  <div class="block-icon">
                    <Icon icon="mdi:information-outline" />
                  </div>
                  <div class="block-details">
                    <div class="block-title">
                      О приложении
                    </div>
                    <div class="block-desc">
                      Установленная версия: <strong>v{{ appVersion }}</strong>
                    </div>
                  </div>
                </div>

                <div class="update-action-row">
                  <KitBtn
                    variant="outlined"
                    color="secondary"
                    size="md"
                    :disabled="isCheckingUpdate"
                    :loading="isCheckingUpdate"
                    icon="mdi:refresh"
                    @click="checkManualUpdate"
                  >
                    {{ isCheckingUpdate ? 'Проверка...' : 'Проверить обновления' }}
                  </KitBtn>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Вкладка 5: Опасная зона -->
        <template #danger>
          <div class="settings-card danger-card">
            <div class="card-header danger-header">
              <div class="card-title-group">
                <h2 class="card-title text-danger">
                  Удаление аккаунта
                </h2>
                <p class="card-subtitle">
                  Безвозвратное удаление вашего профиля и всех связанных данных
                </p>
              </div>
              <div class="danger-badge">
                <Icon icon="mdi:alert-octagon-outline" />
                <span>Необратимо</span>
              </div>
            </div>

            <div class="card-body">
              <div class="danger-warning-box">
                <Icon icon="mdi:alert" class="warning-icon" />
                <div class="warning-text">
                  <strong>Внимание!</strong> При удалении аккаунта все созданные путешествия, точки маршрутов, заметки, загруженные фото и отзывы будут безвозвратно удалены. Восстановить эти данные будет невозможно.
                </div>
              </div>

              <div class="danger-form">
                <div class="form-field">
                  <KitInput
                    v-model="deleteForm.password"
                    label="Подтвердите пароль"
                    placeholder="Введите ваш текущий пароль для подтверждения"
                    type="password"
                    icon="mdi:lock-alert-outline"
                  />
                </div>
              </div>
            </div>

            <div class="card-footer danger-footer">
              <div style="flex-grow: 1" />
              <KitBtn
                variant="solid"
                color="secondary"
                size="md"
                class="delete-account-btn"
                :disabled="!deleteForm.password || isDeletingAccount"
                :loading="isDeletingAccount"
                icon="mdi:delete-forever-outline"
                @click="deleteAccount"
              >
                Удалить аккаунт навсегда
              </KitBtn>
            </div>
          </div>
        </template>
      </KitTabs>
    </div>

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
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 4rem;
}

.settings-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    color: var(--fg-primary-color);
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin: 0;
    line-height: 1.4;
  }

  @include media-down(sm) {
    .page-title {
      font-size: 1.6rem;
    }
    .page-subtitle {
      font-size: 0.9rem;
    }
  }
}

.settings-tabs-wrapper {
  width: 100%;
}

/* Общий стиль карточек настроек */
.settings-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  box-shadow: var(--s-xs);
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border-secondary-color);

  .card-title-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .card-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    color: var(--fg-primary-color);
  }

  .card-subtitle {
    font-size: 0.875rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card-footer {
  padding: 1rem 1.5rem;
  background-color: var(--bg-tertiary-color);
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.save-status {
  display: flex;
  align-items: center;
  font-size: 0.875rem;

  .changed-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--fg-accent-color);
    font-weight: 500;
  }
}

/* Витрина профиля (Showcase) */
.profile-banner-showcase {
  position: relative;
  background-color: var(--bg-tertiary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  margin-bottom: 0.5rem;

  .cover-canvas {
    position: relative;
    width: 100%;
    height: 180px;
    background-color: var(--bg-tertiary-color);
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 1rem;
    transition: all 0.3s ease;

    .cover-action-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: var(--r-full);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(0, 0, 0, 0.8);
        transform: translateY(-1px);
        border-color: rgba(255, 255, 255, 0.4);
      }

      .badge-icon {
        font-size: 1rem;
      }
    }
  }

  .avatar-overlap-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 1.25rem;
    padding: 0 1.5rem 1.25rem;
    margin-top: -48px;
    position: relative;
    z-index: 2;

    .avatar-interactive-container {
      position: relative;
      flex-shrink: 0;

      .banner-avatar {
        border: 4px solid var(--bg-secondary-color);
        box-shadow: var(--s-m);
      }

      .avatar-action-btn {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: var(--fg-accent-color);
        color: #ffffff;
        border: 2px solid var(--bg-secondary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        cursor: pointer;
        box-shadow: var(--s-s);
        transition: all 0.2s ease;

        &:hover {
          transform: scale(1.08);
          filter: brightness(1.1);
        }
      }
    }

    .user-quick-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding-bottom: 0.5rem;

      .user-display-name {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--fg-primary-color);
        line-height: 1.2;
      }

      .user-display-email {
        font-size: 0.875rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}

/* Формы */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  &.full-row {
    grid-column: 1 / -1;
  }

  .field-hint {
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
    padding-left: 2px;
  }
}

/* Сетка интеграций */
.integrations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.integration-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  gap: 1rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    box-shadow: var(--s-xs);
  }

  &.is-active {
    border-color: var(--border-success-color);
    background-color: var(--bg-primary-color);
  }
}

.tile-leading {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.provider-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: var(--r-s);
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
}

.yandex-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fc3f1d;
  color: #ffffff;
  font-family:
    Arial,
    -apple-system,
    sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1;
}

.tile-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  .provider-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.provider-status-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
  color: var(--fg-tertiary-color);

  .status-icon {
    font-size: 0.95rem;
  }

  &.linked {
    color: var(--fg-success-color);
    font-weight: 500;
  }
}

/* Безопасность */
.security-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  white-space: nowrap;
  flex-shrink: 0;

  &.secure {
    background-color: var(--bg-success-color);
    color: var(--fg-success-color);
    font-weight: 500;
  }
}

.password-fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.security-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: var(--r-m);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 1.25rem;

  .callout-icon {
    font-size: 1.5rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .callout-text {
    font-size: 0.875rem;
    color: var(--fg-secondary-color);
    line-height: 1.4;

    strong {
      color: var(--fg-primary-color);
      display: block;
      margin-bottom: 2px;
    }

    p {
      margin: 0;
    }
  }
}

/* Системные настройки */
.system-settings-body {
  gap: 1.5rem;
}

.system-block {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.system-block-info {
  display: flex;
  align-items: flex-start;
  gap: 1rem;

  .block-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--r-s);
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .block-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .block-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .block-desc {
      font-size: 0.875rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }
}

.vault-picker-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .vault-path-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 8px 12px;
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    font-size: 0.875rem;
    color: var(--fg-primary-color);
    overflow: hidden;

    .path-icon {
      font-size: 1.1rem;
      color: var(--fg-tertiary-color);
      flex-shrink: 0;
    }

    .path-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
  }
}

.update-action-row {
  display: flex;
  justify-content: flex-start;
}

/* Опасная зона */
.danger-card {
  border-color: var(--border-error-color);

  .danger-header {
    background-color: var(--bg-error-color);
  }

  .text-danger {
    color: var(--fg-error-color);
  }

  .danger-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-size: 0.75rem;
    font-weight: 600;
    background-color: var(--fg-error-color);
    color: #ffffff;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .danger-warning-box {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: var(--r-m);
    background-color: var(--bg-error-color);
    border: 1px solid var(--border-error-color);

    .warning-icon {
      font-size: 1.4rem;
      color: var(--fg-error-color);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .warning-text {
      font-size: 0.875rem;
      color: var(--fg-error-color);
      line-height: 1.4;
    }
  }

  .danger-form {
    max-width: 450px;
  }

  .delete-account-btn {
    background-color: var(--fg-error-color) !important;
    color: #ffffff !important;
    border: none !important;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  }
}

/* Telegram Dialog */
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

/* Cropper */
.cropper-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
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
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-secondary-color);

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
      border-radius: var(--r-xs);

      &:hover {
        color: var(--fg-primary-color);
        background-color: var(--bg-hover-color);
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

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .profile-banner-showcase {
    .cover-canvas {
      height: 140px;
    }

    .avatar-overlap-wrapper {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      margin-top: -40px;
    }
  }

  .cropper-overlay {
    padding: 0;
  }

  .cropper-modal {
    height: 100dvh;
    height: 100vh;
    border-radius: 0;
    justify-content: space-between;

    .cropper-header {
      padding-top: calc(1rem + var(--safe-area-inset-top));
      padding-left: calc(1.5rem + var(--safe-area-inset-left));
      padding-right: calc(1.5rem + var(--safe-area-inset-right));
    }

    .cropper-body {
      flex-grow: 1;
      height: auto;
    }

    .cropper-footer {
      padding-bottom: calc(1rem + var(--safe-area-inset-bottom));
      padding-left: calc(1.5rem + var(--safe-area-inset-left));
      padding-right: calc(1.5rem + var(--safe-area-inset-right));
    }
  }
}
</style>
