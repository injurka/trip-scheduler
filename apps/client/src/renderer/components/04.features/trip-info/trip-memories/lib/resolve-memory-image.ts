import type { TripImage } from '~/shared/types/models/trip'

export interface MemoryImageSource {
  url: string
  variants: {
    small: string
    medium: string
    large: string
  }
}

interface VaultContext {
  isLocalMode: boolean
  isConfigured: boolean
  localFilesSet: Set<string>
  getRelPath: (tripId: string, imageId: string, dayId?: string) => string
}

export function resolveMemoryImageSource(
  image: TripImage,
  vault: VaultContext,
  tripId: string | null,
  dayId: string | undefined,
): MemoryImageSource {
  const serverUrl = resolveApiUrl(image.url)
  
  const variants = {
    small: image.variants?.small ? resolveApiUrl(image.variants.small) : serverUrl,
    medium: image.variants?.medium ? resolveApiUrl(image.variants.medium) : serverUrl,
    large: image.variants?.large ? resolveApiUrl(image.variants.large) : serverUrl,
  }

  if (vault.isLocalMode && vault.isConfigured && tripId && dayId) {
    const relPath = vault.getRelPath(tripId, image.id, dayId)
    if (vault.localFilesSet.has(relPath)) {
      const localUrl = `trip-scheduler-vault://${relPath}`
      return {
        url: localUrl,
        variants: { small: localUrl, medium: localUrl, large: localUrl },
      }
    }
  }

  return { url: serverUrl, variants }
}
