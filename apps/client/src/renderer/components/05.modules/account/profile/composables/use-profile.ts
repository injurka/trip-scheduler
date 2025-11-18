function useProfile() {
  const store = useAppStore(['auth'])
  const toast = useToast()
  const confirm = useConfirm()

  const user = computed(() => store.auth.user)

  // --- Profile Info Form ---
  const profileForm = reactive({
    name: user.value?.name || '',
    email: user.value?.email || '',
  })

  const isProfileChanged = computed(() => profileForm.name !== user.value?.name)
  const isUpdatingProfile = ref(false)

  // --- Password Change Form ---
  const passwordForm = reactive({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const isChangingPassword = ref(false)

  const isPasswordFormValid = computed(() =>
    passwordForm.currentPassword
    && passwordForm.newPassword.length >= 6
    && passwordForm.newPassword === passwordForm.confirmPassword,
  )

  // --- Delete Account Form ---
  const deleteForm = reactive({
    password: '',
  })
  const isDeletingAccount = ref(false)

  // --- Methods ---
  async function updateProfile(data?: { name?: string, avatarUrl?: string }) {
    isUpdatingProfile.value = true
    try {
      const payload = data || { name: profileForm.name }
      await store.auth.updateUser(payload)
      toast.success('Профиль успешно обновлен')
    }
    catch (e: any) {
      toast.error(e.message || 'Ошибка при обновлении профиля')
    }
    finally {
      isUpdatingProfile.value = false
    }
  }

  async function changePassword() {
    if (!isPasswordFormValid.value)
      return

    isChangingPassword.value = true
    try {
      // TODO
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
      // TODO
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

    isUpdatingProfile.value = true
    try {
      await store.auth.uploadAvatar(file)
      toast.success('Аватар успешно обновлен')
    }
    catch {
      toast.error('Не удалось загрузить аватар.')
    }
    finally {
      isUpdatingProfile.value = false
    }
  }

  watch(user, (newUser) => {
    if (newUser) {
      profileForm.name = newUser.name || ''
      profileForm.email = newUser.email || ''
    }
  })

  return {
    user,
    profileForm,
    passwordForm,
    deleteForm,
    isProfileChanged,
    isPasswordFormValid,
    isUpdatingProfile,
    isChangingPassword,
    isDeletingAccount,
    updateProfile,
    changePassword,
    deleteAccount,
    handleAvatarUpload,
  }
}

export { useProfile }
