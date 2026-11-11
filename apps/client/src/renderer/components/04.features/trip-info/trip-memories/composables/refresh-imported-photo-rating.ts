interface Options {
  isCurrent: () => boolean
  loadMetadata: () => Promise<unknown>
  loadRating: () => Promise<number | null | undefined>
  applyRating: (rating: number) => void
  delay?: (ms: number) => Promise<void>
}

/** Refresh only the imported stars; never replace locally edited memory fields. */
export async function refreshImportedPhotoRating(options: Options): Promise<void> {
  const delay = options.delay ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))

  try {
    for (const ms of [0, 1000, 2000, 4000, 8000, 16000]) {
      await delay(ms)

      if (!options.isCurrent())
        return

      const metadata = await options.loadMetadata() as { technical?: { format?: string } } | null

      if (!metadata?.technical?.format)
        continue

      const rating = await options.loadRating()

      if (options.isCurrent() && rating != null)
        options.applyRating(rating)

      return
    }
  }
  catch {
    // The upload already succeeded; a later fetch retrieves the persisted rating.
  }
}
