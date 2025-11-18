import { createStoreHook } from '~/shared/lib/create-store-hook'

import { useThemeStore } from '~/shared/store/theme.store'
import { useAuthStore } from '../store/auth.store'
import { useConfirmDialogStore } from '../store/confirm-dialog.store'
import { useLayoutStore } from '../store/layout.store'
import { useToastStore } from '../store/toast.store'

const appStores = {
  theme: useThemeStore,
  auth: useAuthStore,
  toast: useToastStore,
  confirmDialog: useConfirmDialogStore,
  layout: useLayoutStore,
}

export const useAppStore = createStoreHook(appStores)
