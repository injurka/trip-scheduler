/** Internal links contain a storage path, never a persisted authentication token. */
export function getDocumentLinkPath(href: string): string | null {
  if (!href.startsWith('#trip-document='))
    return null
  try {
    const path = decodeURIComponent(href.slice('#trip-document='.length))
    if (!/^trips\/[^/?:#]+\/documents\/[^?#]+$/.test(path) || path.split('/').some(part => part === '.' || part === '..'))
      return null
    return path
  }
  catch {
    return null
  }
}
