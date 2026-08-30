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

function stringifyAstNode(node: any): string {
  if (!node)
    return ''
  switch (node.type) {
    case 'text':
      return escapeHtml(node.value || '')
    case 'html':
      return node.value || ''
    case 'inlineCode':
      return `<code>${escapeHtml(node.value || '')}</code>`
    case 'strong':
      return `<strong>${(node.children || []).map(stringifyAstNode).join('')}</strong>`
    case 'emphasis':
      return `<em>${(node.children || []).map(stringifyAstNode).join('')}</em>`
    case 'delete':
      return `<del>${(node.children || []).map(stringifyAstNode).join('')}</del>`
    case 'link':
      return `<a href="${escapeHtml(node.url || '')}"${node.title ? ` title="${escapeHtml(node.title)}"` : ''}>${(node.children || []).map(stringifyAstNode).join('')}</a>`
    default:
      if (node.value)
        return escapeHtml(node.value)
      if (Array.isArray(node.children))
        return node.children.map(stringifyAstNode).join('')
      return ''
  }
}

function mergeInlineHtmlInNodeList(children: any[]): any[] {
  const result: any[] = []
  let i = 0

  while (i < children.length) {
    const child = children[i]

    if (child.type === 'html') {
      const stack: string[] = []
      updateStackWithHtml(child.value || '', stack)

      if (stack.length > 0) {
        let accumulatedHtml = child.value || ''
        let j = i + 1
        let isClosed = false

        while (j < children.length) {
          const nextChild = children[j]
          accumulatedHtml += stringifyAstNode(nextChild)

          if (nextChild.type === 'html') {
            updateStackWithHtml(nextChild.value || '', stack)
          }

          if (stack.length === 0) {
            isClosed = true
            break
          }
          j++
        }

        if (isClosed) {
          result.push({
            type: 'html',
            value: accumulatedHtml,
          })
          i = j + 1
          continue
        }
      }
    }

    result.push(child)
    i++
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
