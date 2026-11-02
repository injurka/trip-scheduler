export {
  base64ToUint8Array,
  getThumbHashApproximateAspectRatio,
  getThumbHashAspectRatio,
  getThumbHashAverageColor,
  getThumbHashDataUrl,
} from '@limiteddissolve/kit-image-viewer'

interface ThumbhashImage {
  variants?: { thumbhash?: string } | null
  metadata?: { thumbhash?: string } | null
}

/** Prefer the display manifest; support metadata from older image records. */
export function getImageThumbhash(image?: ThumbhashImage | null): string | null {
  return image?.variants?.thumbhash || image?.metadata?.thumbhash || null
}
