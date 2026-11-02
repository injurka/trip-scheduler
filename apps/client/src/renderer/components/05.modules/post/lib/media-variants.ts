import type { PostMedia } from '~/shared/types/models/post'

export function getPostMediaVariants(media: PostMedia): Record<string, string> {
  const metadataVariants = media.metadata?.variants

  return {
    ...(metadataVariants && typeof metadataVariants === 'object' ? metadataVariants : {}),
    ...(typeof media.metadata?.thumbhash === 'string' ? { thumbhash: media.metadata.thumbhash } : {}),
    ...(media.variants && typeof media.variants === 'object' ? media.variants : {}),
  }
}
