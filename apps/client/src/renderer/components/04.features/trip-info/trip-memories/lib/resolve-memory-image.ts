import type { TripMedia } from '~/shared/types/models/trip'

export interface MemoryImageSource {
  url: string
  variants: {
    small: string
    medium: string
    large: string
    poster?: string
    web?: string
  }
}

export type MemoryMediaSource = MemoryImageSource

interface VaultContext {
  isLocalMode: boolean
  isConfigured: boolean
  localFilesSet: Set<string>
  getRelPath: (tripId: string, imageId: string, dayId?: string) => string
}

export function resolveMemoryImageSource(
  image: TripMedia,
  vault: VaultContext,
  tripId: string | null,
  dayId: string | undefined,
): MemoryImageSource {
  const serverUrl = resolveApiUrl(image.url)

  const variants = {
    small: image.variants?.small ? resolveApiUrl(image.variants.small) : (image.variants?.poster ? resolveApiUrl(image.variants.poster) : serverUrl),
    medium: image.variants?.medium ? resolveApiUrl(image.variants.medium) : (image.variants?.poster ? resolveApiUrl(image.variants.poster) : serverUrl),
    large: image.variants?.large ? resolveApiUrl(image.variants.large) : (image.variants?.web ? resolveApiUrl(image.variants.web) : serverUrl),
    poster: image.variants?.poster ? resolveApiUrl(image.variants.poster) : (image.variants?.small ? resolveApiUrl(image.variants.small) : undefined),
    web: image.variants?.web ? resolveApiUrl(image.variants.web) : (image.variants?.large ? resolveApiUrl(image.variants.large) : undefined),
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
