import { validateFolderTree } from '@injurka/type-utils'
import { z } from 'zod'

const ContentSchema = z.object({
  folders: z.array(z.object({ id: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), parentId: z.string().min(1).max(128).nullable().optional(), color: z.string().optional(), icon: z.string().optional() }).passthrough()).max(2000).default([]),
}).passthrough()

export function parseDocumentFolders(value: unknown, previous?: unknown) {
  const content = ContentSchema.parse(value ?? {})
  const old = ContentSchema.safeParse(previous)
  // Old clients may not send parentId. Preserve an existing relationship in that case.
  content.folders = content.folders.map(folder => ({ ...folder, parentId: folder.parentId === undefined ? old.success ? old.data.folders.find(f => f.id === folder.id)?.parentId ?? null : null : folder.parentId }))
  validateFolderTree(content.folders)
  return content
}
