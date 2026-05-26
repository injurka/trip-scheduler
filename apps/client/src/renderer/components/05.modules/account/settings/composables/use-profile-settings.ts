import { useVaultMemoriesStore } from '~/components/04.features/trip-info/trip-memories/store/vault-memories.store'
import { useRequestStatus } from '~/plugins/request'
import { AppRouteNames } from '~/shared/constants/routes'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { EAuthRequestKeys, useAuthStore } from '~/shared/store/auth.store'

export function useProfileSettings() {
  const authStore = useAuthStore()
  const toast = useToast()
  const confirm = useConfirm()
  const router = useRouter()
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

  const isUpdatingProfile = useRequestStatus([EAuthRequestKeys.UPDATE_USER, EAuthRequestKeys.UPLOAD_AVATAR])

  // Кнопка сохранения активна, если изменено имя ИЛИ выбрана новая обложка
  const isProfileChanged = computed(() => profileForm.name !== user.value?.name || !!coverFile.value)

  const isPasswordFormValid = computed(() =>
    passwordForm.currentPassword
    && passwordForm.newPassword.length >= 6
    && passwordForm.newPassword === passwordForm.confirmPassword,
  )

  const deleteForm = reactive({
    password: '',
  })
  const isDeletingAccount = ref(false)

  async function updateProfile() {
    try {
      await authStore.updateUser({ name: profileForm.name })

      // Предполагаем, что в authStore есть или будет добавлен метод uploadCover
      if (coverFile.value && (authStore as any).uploadCover) {
        await (authStore as any).uploadCover(coverFile.value)
      }

      toast.success('Профиль успешно обновлен')
      coverFile.value = null // Сбрасываем выбранный файл после успеха
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

    // Сохраняем во временный URL для отображения в кроппере
    tempCoverUrl.value = URL.createObjectURL(file)
    isCropperVisible.value = true

    // Сбрасываем input
    input.value = ''
  }

  function cancelCrop() {
    isCropperVisible.value = false
    if (tempCoverUrl.value) {
      URL.revokeObjectURL(tempCoverUrl.value) // очистка памяти
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
        URL.revokeObjectURL(coverPreviewUrl.value) // очистка старого превью
      }
      coverPreviewUrl.value = URL.createObjectURL(croppedFile)

      isCropperVisible.value = false
      if (tempCoverUrl.value) {
        URL.revokeObjectURL(tempCoverUrl.value) // очистка исходника
        tempCoverUrl.value = null
      }

      isPreviewVisible.value = true // Автоматически открываем превью
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
  })

  return {
    vaultPath: vaultStore.vaultPath,
    selectVaultFolder: vaultStore.selectFolder,
    isElectron: vaultStore.isElectron,
    user,
    profileForm,
    passwordForm,
    deleteForm,
    coverFile,
    coverPreviewUrl,
    isPreviewVisible,
    tempCoverUrl,
    isCropperVisible,
    isProfileChanged,
    isPasswordFormValid,
    isUpdatingProfile,
    isChangingPassword,
    isDeletingAccount,
    updateProfile,
    changePassword,
    deleteAccount,
    handleAvatarUpload,
    handleCoverSelect,
    cancelCrop,
    saveCroppedImage,
  }
}
