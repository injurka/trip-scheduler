import { $remark } from '@milkdown/utils'

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const HTML_TAG_REGEX = /<(\/)?([a-z0-9]+)(\s[^>]*)?>/gi

function updateStackWithHtml(html: string, stack: string[]) {
  const matches = [...html.matchAll(HTML_TAG_REGEX)]

  for (const match of matches) {
    const isClose = match[1] === '/'
    const tagName = match[2].toLowerCase()
    const rest = match[3] || ''
    const isSelfClosing = rest.trimEnd().endsWith('/') || VOID_TAGS.has(tagName)

    if (isClose) {
      const idx = stack.lastIndexOf(tagName)

      if (idx !== -1) {
        stack.splice(idx, stack.length - idx)
      }
    }
    else if (!isSelfClosing) {
      stack.push(tagName)
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stringifyChildren(node: any): string {
  return (node.children || []).map(stringifyAstNode).join('')
}

function stringifyLink(node: any): string {
  const titleAttribute = node.title ? ` title="${escapeHtml(node.title)}"` : ''

  return `<a href="${escapeHtml(node.url || '')}"${titleAttribute}>${stringifyChildren(node)}</a>`
}

const astNodeRenderers: Record<string, (node: any) => string> = {
  text: node => escapeHtml(node.value || ''),
  html: node => node.value || '',
  inlineCode: node => `<code>${escapeHtml(node.value || '')}</code>`,
  strong: node => `<strong>${stringifyChildren(node)}</strong>`,
  emphasis: node => `<em>${stringifyChildren(node)}</em>`,
  delete: node => `<del>${stringifyChildren(node)}</del>`,
  link: stringifyLink,
}

function stringifyFallbackAstNode(node: any): string {
  if (node.value)
    return escapeHtml(node.value)

  if (Array.isArray(node.children))
    return stringifyChildren(node)

  return ''
}

function stringifyAstNode(node: any): string {
  if (!node)
    return ''

  const renderer = astNodeRenderers[node.type]

  return renderer ? renderer(node) : stringifyFallbackAstNode(node)
}

function mergeInlineHtmlAt(children: any[], startIndex: number): { node: any, nextIndex: number } | null {
  const child = children[startIndex]
  const stack: string[] = []
  updateStackWithHtml(child.value || '', stack)

  if (stack.length === 0)
    return null

  let accumulatedHtml = child.value || ''
  let index = startIndex + 1

  while (index < children.length) {
    const nextChild = children[index]
    accumulatedHtml += stringifyAstNode(nextChild)

    if (nextChild.type === 'html')
      updateStackWithHtml(nextChild.value || '', stack)

    if (stack.length === 0) {
      return {
        node: { type: 'html', value: accumulatedHtml },
        nextIndex: index + 1,
      }
    }

    index++
  }

  return null
}

function mergeInlineHtmlInNodeList(children: any[]): any[] {
  const result: any[] = []
  let index = 0

  while (index < children.length) {
    const child = children[index]

    if (child.type === 'html') {
      const merged = mergeInlineHtmlAt(children, index)

      if (merged) {
        result.push(merged.node)
        index = merged.nextIndex
        continue
      }
    }

    result.push(child)
    index++
  }

  return result
}

function transformTree(node: any) {
  if (!node)
    return

  if (Array.isArray(node.children)) {
    node.children = mergeInlineHtmlInNodeList(node.children)

    for (const child of node.children) {
      transformTree(child)
    }
  }
}

export const remarkHtmlMergePlugin = $remark('remarkHtmlMerge', () => () => (tree: any) => {
  transformTree(tree)
})
