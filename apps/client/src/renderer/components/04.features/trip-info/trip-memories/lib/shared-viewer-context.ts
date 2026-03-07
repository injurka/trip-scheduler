import type { InjectionKey } from 'vue'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'

export interface SharedMemoryViewerContext {
  openImageViewer: (memory: IMemory) => void
}

export const SHARED_VIEWER_KEY: InjectionKey<SharedMemoryViewerContext> = Symbol('shared-memory-viewer')
