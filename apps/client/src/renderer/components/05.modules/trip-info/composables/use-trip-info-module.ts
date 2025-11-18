import { useTripMemoriesStore } from '~/components/04.features/trip-info/trip-memories'
import { useTripPlanStore } from '~/components/04.features/trip-info/trip-plan'
import { createStoreHook } from '~/shared/lib/create-store-hook'
import { useTripInfoGalleryStore } from '../store/trip-info-route-gallery.store'
import { useTripSectionsStore } from '../store/trip-info-sections.store'
import { useTripInfoUiStore } from '../store/trip-info-ui.store'

const moduleStores = {
  plan: useTripPlanStore,
  memories: useTripMemoriesStore,
  sections: useTripSectionsStore,
  ui: useTripInfoUiStore,
  routeGallery: useTripInfoGalleryStore,
}

export const useModuleStore = createStoreHook(moduleStores)
