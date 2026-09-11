/**
 * Generates a deterministic UUID-shaped identifier for imported entities.
 * The importer stores these IDs inside JSON content, so stability is more
 * important here than cryptographic randomness: the same vault must produce
 * the same cross-references on every run.
 */
export function stableId(namespace: string, ...parts: unknown[]): string {
  const value = `${namespace}\u001F${parts.map(part => String(part ?? '')).join('\u001F')}`
  const words = [0x811C9DC5, 0x9E3779B9, 0x85EBCA6B, 0xC2B2AE35]

  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    let hash = words[wordIndex] >>> 0
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index) + wordIndex * 31
      hash = Math.imul(hash, 0x01000193)
      hash ^= hash >>> 13
    }
    words[wordIndex] = hash >>> 0
  }

  const hex = words.map(word => word.toString(16).padStart(8, '0')).join('')
  const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3F) | 0x80).toString(16).padStart(2, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`
}
