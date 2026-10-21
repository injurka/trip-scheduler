import type { ActivityPayload } from '../types'
import { basename, relative } from 'node:path'

export interface UploadedDocumentLink {
  filePath: string
  url: string
}

/** Resolve only successfully uploaded documents; ambiguous short names stay untouched. */
export function convertDocumentLinks(text: string, tripRoot: string, documents: UploadedDocumentLink[]): string {
  const entries = documents.filter(doc => doc.url).map(doc => ({
    path: relative(tripRoot, doc.filePath).replace(/\\/g, '/'),
    url: doc.url,
  }))
  // Leave code examples and embedded images to their existing parsers.
  return text.replace(/```[^]*?```|~~~[^]*?~~~|`[^`\n]*`|!?\[\[([^\n]+?)\]\]/g, (match, body: string | undefined) => {
    if (!body || match.startsWith('!'))
      return match
    const separator = body.indexOf('|')
    const target = (separator < 0 ? body : body.slice(0, separator)).trim().replace(/\\/g, '/').replace(/^\.\//, '')
    const exact = entries.filter(doc => doc.path === target)
    const matches = exact.length ? exact : entries.filter(doc => doc.path.endsWith(`/${target}`))
    if (matches.length !== 1)
      return match
    const label = (separator < 0 ? basename(target) : body.slice(separator + 1)).replace(/([\\`*_[\]<>])/g, '\\$1')
    return `[${label}](#trip-document=${encodeURIComponent(matches[0]!.url)})`
  })
}

export function convertActivityDocumentLinks(activity: ActivityPayload, tripRoot: string, documents: UploadedDocumentLink[]): ActivityPayload['sections'] {
  return activity.sections?.map(section => section.type === 'description'
    ? { ...section, text: convertDocumentLinks(section.text, tripRoot, documents) }
    : section)
}
