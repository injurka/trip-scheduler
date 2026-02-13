import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { useVaultMemoriesStore } from '../store/vault-memories.store'

export function useTripMemoriesVault() {
  const vaultStore = useVaultMemoriesStore()
  const authStore = useAuthStore()
  const router = useRouter()
  const confirm = useConfirm()

  const { plan: tripData, memories } = useModuleStore(['plan', 'memories'])
  const { memoriesForSelectedDay } = storeToRefs(memories)

  onMounted(() => {
    vaultStore.init()
  })

  watch(
    [() => tripData.currentTripId, () => memories.memories],
    async ([tId, mems]) => {
      if (tId && mems && mems.length > 0 && vaultStore.isConfigured) {
        const imageIds = mems
          .filter((m: any) => m.imageId && m.image)
          .map((m: any) => m.image!.id)

        await vaultStore.checkFilesAvailability(tId as string, imageIds)
      }
    },
    { deep: true, immediate: true },
  )

  async function ensureVaultConfigured(description: string): Promise<boolean> {
    if (vaultStore.isConfigured)
      return true

    const isConfirmed = await confirm({
      title: 'Папка не выбрана',
      description,
      confirmText: 'Перейти в настройки',
      type: 'default',
    })

    if (isConfirmed && authStore.user) {
      router.push(AppRoutePaths.User.Settings(authStore.user.id))
    }
    return false
  }

  async function handleToggleLocalMode() {
    const isConfigured = await ensureVaultConfigured(
      'Включить локальный режим невозможно, пока не выбрана папка хранилища.',
    )

    if (isConfigured) {
      vaultStore.isLocalMode = !vaultStore.isLocalMode
    }
  }

  async function handleDownloadVault() {
    if (!tripData.currentTripId)
      return

    const isConfigured = await ensureVaultConfigured(
      'Выберите папку на компьютере для сохранения фотографий, чтобы просматривать их оффлайн.',
    )

    if (!isConfigured)
      return

    const imagesToSync = memoriesForSelectedDay.value
      .filter((m: any) => m.image && m.imageId)
      .map((m: any) => ({
        id: m.image!.id,
        url: m.image!.url,
        sizeBytes: m.image!.sizeBytes || 0,
      }))

    if (imagesToSync.length === 0) {
      const toast = useToast()
      toast.info('Нет фотографий для скачивания в этом дне')
      return
    }

    await vaultStore.syncImages(tripData.currentTripId, imagesToSync)
  }

  return {
    vaultStore,
    handleToggleLocalMode,
    handleDownloadVault,

    isElectron: computed(() => vaultStore.isElectron),
    syncState: computed(() => vaultStore.syncState),
    isLocalMode: computed(() => vaultStore.isLocalMode),
    isConfigured: computed(() => vaultStore.isConfigured),
  }
}
