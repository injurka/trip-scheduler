export interface FolderNode { id: string, parentId?: string | null, name: string }

/** Reject malformed graphs before persistence; old folders without a parent are roots. */
export function validateFolderTree(folders: FolderNode[]): void {
  const byId = new Map(folders.map(f => [f.id, f]))
  if (byId.size !== folders.length)
    throw new Error('Идентификаторы папок должны быть уникальными.')
  for (const folder of folders) {
    const seen = new Set<string>([folder.id])
    let parent = folder.parentId
    while (parent) {
      if (seen.has(parent))
        throw new Error('Нельзя переместить папку внутрь самой себя или её подпапки.')
      const node = byId.get(parent)
      if (!node)
        throw new Error('Родительская папка не найдена в этом разделе.')
      seen.add(parent)
      if (seen.size > 64)
        throw new Error('Допускается не более 64 уровней вложенности.')
      parent = node.parentId
    }
  }
}

/** Defensive traversal keeps even damaged legacy data navigable without recursion loops. */
export function folderPath<T extends FolderNode>(folders: T[], id: string | null): T[] {
  const path: T[] = []
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const folder = folders.find(f => f.id === id)
    if (!folder)
      break
    path.unshift(folder)
    id = folder.parentId ?? null
  }
  return path
}
