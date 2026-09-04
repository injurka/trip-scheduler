import { useVaultMemoriesStore } from '~/components/04.features/trip-info/trip-memories/store/vault-memories.store'
import { useRequestStatus } from '~/plugins/request'
import { AppRouteNames } from '~/shared/constants/routes'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { EAuthRequestKeys, TOKEN_KEY, useAuthStore } from '~/shared/store/auth.store'

export function useProfileSettings() {
  const authStore = useAuthStore()
  const toast = useToast()
  const confirm = useConfirm()
  const router = useRouter()
  const route = useRoute()
  const vaultStore = useVaultMemoriesStore()

  const user = computed(() => authStore.user)

  const profileForm = reactive({
    name: user.value?.name || '',
    email: user.value?.email || '',
  })

  // Состояния для загрузки обложки профиля
  const coverFile = ref<File | null>(null)
  const coverPreviewUrl = ref<string | null>(null)
  const isPreviewVisible = ref(false)

  // Состояния для работы с кроппером
  const tempCoverUrl = ref<string | null>(null)
  const isCropperVisible = ref(false)

  const passwordForm = reactive({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const isChangingPassword = ref(false)

  const setPasswordForm = reactive({
    newPassword: '',
    confirmPassword: '',
  })
  const isSettingPassword = ref(false)

  const isUpdatingProfile = useRequestStatus([EAuthRequestKeys.UPDATE_USER, EAuthRequestKeys.UPLOAD_AVATAR])

  // Кнопка сохранения активна, если изменено имя ИЛИ выбрана новая обложка
  const isProfileChanged = computed(() => profileForm.name !== user.value?.name || !!coverFile.value)

  const isPasswordFormValid = computed(() =>
    passwordForm.currentPassword
    && passwordForm.newPassword.length >= 6
    && passwordForm.newPassword === passwordForm.confirmPassword,
  )

  const isSetPasswordFormValid = computed(() =>
    setPasswordForm.newPassword.length >= 6
    && setPasswordForm.newPassword === setPasswordForm.confirmPassword,
  )

  const deleteForm = reactive({
    password: '',
  })
  const isDeletingAccount = ref(false)

  // Состояния для привязки Telegram
  const isTelegramModalVisible = ref(false)
  const isTelegramLinking = ref(false)
  const telegramLinkUrl = ref('')
  let telegramPollInterval: any = null

  // Состояния провайдеров
  const isYandexLinked = computed(() => Boolean(user.value?.yandexId))
  const isGoogleLinked = computed(() => Boolean(user.value?.googleId))
  const isGithubLinked = computed(() => Boolean(user.value?.githubId))
  const isTelegramLinked = computed(() => Boolean(user.value?.telegramId))
  const hasPassword = computed(() => Boolean((user.value as any)?.hasPassword))

  const unlinkingProvider = ref<string | null>(null)

  async function updateProfile() {
    try {
      await authStore.updateUser({ name: profileForm.name })

      if (coverFile.value && (authStore as any).uploadCover) {
        await (authStore as any).uploadCover(coverFile.value)
      }

      toast.success('Профиль успешно обновлен')
      coverFile.value = null
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка при обновлении профиля')
    }
  }

  async function changePassword() {
    if (!isPasswordFormValid.value)
      return

    isChangingPassword.value = true
    try {
      await trpc.user.changePassword.mutate({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      toast.success('Пароль успешно изменен')
      Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка при смене пароля')
    }
    finally {
      isChangingPassword.value = false
    }
  }

  async function setPassword() {
    if (!isSetPasswordFormValid.value)
      return

    isSettingPassword.value = true
    try {
      await authStore.setPassword(setPasswordForm.newPassword)
      toast.success('Пароль успешно установлен!')
      Object.assign(setPasswordForm, { newPassword: '', confirmPassword: '' })
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка при установке пароля')
    }
    finally {
      isSettingPassword.value = false
    }
  }

  function linkOAuth(provider: 'google' | 'github' | 'yandex') {
    const serverUrl = import.meta.env.VITE_APP_SERVER_URL || ''
    const token = authStore.tokenPair?.accessToken || localStorage.getItem(TOKEN_KEY) || ''
    window.location.href = `${serverUrl}/api/auth/${provider}/login?linkToken=${encodeURIComponent(token)}`
  }

  async function startTelegramLink() {
    isTelegramLinking.value = true
    try {
      const res = await authStore.initTelegramLink()
      telegramLinkUrl.value = res.url
      isTelegramModalVisible.value = true

      if (telegramPollInterval) {
        clearInterval(telegramPollInterval)
      }

      telegramPollInterval = setInterval(async () => {
        try {
          const statusRes = await authStore.checkTelegramLinkStatus(res.token)
          if (statusRes.status === 'confirmed') {
            clearInterval(telegramPollInterval)
            telegramPollInterval = null
            isTelegramModalVisible.value = false
            isTelegramLinking.value = false
            toast.success('Telegram успешно привязан к вашему профилю!')
          }
          else if (statusRes.status === 'already_linked') {
            clearInterval(telegramPollInterval)
            telegramPollInterval = null
            isTelegramModalVisible.value = false
            isTelegramLinking.value = false
            toast.error(statusRes.message || 'Этот Telegram-аккаунт уже привязан к другому пользователю')
          }
          else if (statusRes.status === 'cancelled' || statusRes.status === 'expired') {
            clearInterval(telegramPollInterval)
            telegramPollInterval = null
            isTelegramModalVisible.value = false
            isTelegramLinking.value = false
            toast.error('Привязка Telegram отменена или время ссылки истекло')
          }
        }
        catch {
          clearInterval(telegramPollInterval)
          telegramPollInterval = null
          isTelegramModalVisible.value = false
          isTelegramLinking.value = false
        }
      }, 2000)
    }
    catch (e: any) {
      isTelegramLinking.value = false
      toast.error(e.message || 'Не удалось начать привязку Telegram')
    }
  }

  function cancelTelegramLinkModal() {
    if (telegramPollInterval) {
      clearInterval(telegramPollInterval)
      telegramPollInterval = null
    }
    isTelegramModalVisible.value = false
    isTelegramLinking.value = false
  }

  async function unlinkProvider(provider: 'google' | 'github' | 'telegram' | 'yandex') {
    const providerNames: Record<string, string> = {
      yandex: 'Яндекс',
      telegram: 'Telegram',
      google: 'Google',
      github: 'GitHub',
    }

    const isConfirmed = await confirm({
      title: 'Отвязать аккаунт?',
      description: `Вы уверены, что хотите отвязать ${providerNames[provider]} от вашего профиля?`,
      type: 'danger',
      confirmText: 'Отвязать',
    })

    if (!isConfirmed)
      return

    unlinkingProvider.value = provider
    try {
      await authStore.unlinkProvider(provider)
      toast.success(`Аккаунт ${providerNames[provider]} успешно отвязан`)
    }
    catch (e: any) {
      toast.error(e.message || 'Не удалось отвязать аккаунт')
    }
    finally {
      unlinkingProvider.value = null
    }
  }

  async function deleteAccount() {
    const isConfirmed = await confirm({
      title: 'Вы уверены, что хотите удалить аккаунт?',
      description: 'Это действие необратимо. Все ваши данные будут удалены.',
      type: 'danger',
      confirmText: 'Да, удалить мой аккаунт',
    })

    if (!isConfirmed)
      return

    isDeletingAccount.value = true
    try {
      await trpc.user.deleteAccount.mutate({ password: deleteForm.password })
      toast.success('Ваш аккаунт был успешно удален.')
      await authStore.signOut()
      await router.push({ name: AppRouteNames.Root })
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка при удалении аккаунта')
    }
    finally {
      isDeletingAccount.value = false
      deleteForm.password = ''
    }
  }

  async function handleAvatarUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file)
      return

    try {
      await authStore.uploadAvatar(file)
      toast.success('Аватар успешно обновлен')
    }
    catch (e: any) {
      toast.error(e.message || 'Не удалось загрузить аватар.')
    }
  }

  function handleCoverSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file)
      return

    tempCoverUrl.value = URL.createObjectURL(file)
    isCropperVisible.value = true
    input.value = ''
  }

  function cancelCrop() {
    isCropperVisible.value = false
    if (tempCoverUrl.value) {
      URL.revokeObjectURL(tempCoverUrl.value)
      tempCoverUrl.value = null
    }
  }

  function saveCroppedImage(canvas: HTMLCanvasElement) {
    canvas.toBlob((blob) => {
      if (!blob)
        return

      const croppedFile = new File([blob], 'cover-cropped.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })

      coverFile.value = croppedFile
      if (coverPreviewUrl.value) {
        URL.revokeObjectURL(coverPreviewUrl.value)
      }
      coverPreviewUrl.value = URL.createObjectURL(croppedFile)

      isCropperVisible.value = false
      if (tempCoverUrl.value) {
        URL.revokeObjectURL(tempCoverUrl.value)
        tempCoverUrl.value = null
      }

      isPreviewVisible.value = true
    }, 'image/jpeg', 0.9)
  }

  watch(user, (newUser) => {
    if (newUser) {
      profileForm.name = newUser.name || ''
      profileForm.email = newUser.email || ''
    }
  })

  onMounted(() => {
    vaultStore.init()

    if (route.query.oauth_success) {
      const successKey = String(route.query.oauth_success)
      const providerMessages: Record<string, string> = {
        yandex_linked: 'Аккаунт Яндекс успешно привязан!',
        google_linked: 'Аккаунт Google успешно привязан!',
        github_linked: 'Аккаунт GitHub успешно привязан!',
      }
      toast.success(providerMessages[successKey] || 'Аккаунт успешно привязан!')
      authStore.me()
      router.replace({ query: {} })
    }
    else if (route.query.oauth_error) {
      toast.error(decodeURIComponent(String(route.query.oauth_error)))
      router.replace({ query: {} })
    }
  })

  onBeforeUnmount(() => {
    if (telegramPollInterval) {
      clearInterval(telegramPollInterval)
      telegramPollInterval = null
    }
  })

  return {
    vaultPath: vaultStore.vaultPath,
    selectVaultFolder: vaultStore.selectFolder,
    isNative: vaultStore.isNative,
    user,
    profileForm,
    passwordForm,
    setPasswordForm,
    deleteForm,
    coverFile,
    coverPreviewUrl,
    isPreviewVisible,
    tempCoverUrl,
    isCropperVisible,
    isProfileChanged,
    isPasswordFormValid,
    isSetPasswordFormValid,
    isUpdatingProfile,
    isChangingPassword,
    isSettingPassword,
    isDeletingAccount,
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
    updateProfile,
    changePassword,
    setPassword,
    deleteAccount,
    handleAvatarUpload,
    handleCoverSelect,
    cancelCrop,
    saveCroppedImage,
  }
}
