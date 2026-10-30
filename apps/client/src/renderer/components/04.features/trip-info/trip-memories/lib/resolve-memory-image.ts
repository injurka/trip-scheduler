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

type VariantKey = keyof NonNullable<TripMedia['variants']>

function resolveVariantUrl(variants: TripMedia['variants'], preferredKeys: VariantKey[], fallback?: string): string | undefined {
  for (const key of preferredKeys) {
    const value = variants?.[key]

    if (value)
      return resolveApiUrl(value)
  }

  return fallback
}

function getLocalMemorySource(
  image: TripMedia,
  vault: VaultContext,
  tripId: string | null,
  dayId: string | undefined,
): MemoryImageSource | null {
  if (!vault.isLocalMode || !vault.isConfigured || !tripId || !dayId)
    return null

  const relPath = vault.getRelPath(tripId, image.id, dayId)

  if (!vault.localFilesSet.has(relPath))
    return null

  const localUrl = `trip-scheduler-vault://${relPath}`

  return {
    url: localUrl,
    variants: { small: localUrl, medium: localUrl, large: localUrl },
  }
}

export function resolveMemoryImageSource(
  image: TripMedia,
  vault: VaultContext,
  tripId: string | null,
  dayId: string | undefined,
): MemoryImageSource {
  const serverUrl = resolveApiUrl(image.url)

  const variants = {
    small: resolveVariantUrl(image.variants, ['small', 'poster'], serverUrl) ?? serverUrl,
    medium: resolveVariantUrl(image.variants, ['medium', 'poster'], serverUrl) ?? serverUrl,
    large: resolveVariantUrl(image.variants, ['large', 'web'], serverUrl) ?? serverUrl,
    poster: resolveVariantUrl(image.variants, ['poster', 'small']),
    web: resolveVariantUrl(image.variants, ['web', 'large']),
  }

  const localSource = getLocalMemorySource(
    image,
    vault,
    tripId,
    dayId,
  )

  if (localSource)
    return localSource

  return { url: serverUrl, variants }
}
