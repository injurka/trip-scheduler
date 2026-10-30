import type { PostMedia } from '~/shared/types/models/post'

export function getPostMediaVariants(media: PostMedia): Record<string, string> {
  const metadataVariants = media.metadata?.variants

  return {
    ...(metadataVariants && typeof metadataVariants === 'object' ? metadataVariants : {}),
    ...(media.variants && typeof media.variants === 'object' ? media.variants : {}),
  }
}
