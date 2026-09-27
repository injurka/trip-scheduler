const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|gif|heic|heif|svg)$/i

export interface ParsedGalleryBlock {
  title: string
  images: string[]
}

function parseScalar(value: string): string {
  const raw = value.trim()
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw) as string
    }
    catch {
      return ''
    }
  }
  if (raw.startsWith('\'') && raw.endsWith('\''))
    return raw.slice(1, -1).replace(/''/g, '\'')
  return raw
}

function parseFlowList(source: string): string[] | null {
  const raw = source.trim()
  if (!raw.startsWith('[') || !raw.endsWith(']'))
    return null

  const body = raw.slice(1, -1)
  const values: string[] = []
  let token = ''
  let quote = ''
  let escaped = false

  for (const char of body) {
    if (escaped) {
      token += char
      escaped = false
      continue
    }
    if (quote === '"' && char === '\\') {
      token += char
      escaped = true
      continue
    }
    if (quote) {
      token += char
      if (char === quote)
        quote = ''
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      token += char
      continue
    }
    if (char === ',') {
      const value = parseScalar(token)
      if (!value)
        return null
      values.push(value)
      token = ''
      continue
    }
    token += char
  }

  if (quote || escaped)
    return null
  if (token.trim()) {
    const value = parseScalar(token)
    if (!value)
      return null
    values.push(value)
  }
  else if (values.length) {
    return null
  }

  return values.length ? values : null
}

export function parseGalleryBlock(source: string): ParsedGalleryBlock | null {
  const lines = source.split(/\r?\n/)
  let title = ''
  let imageValue: string | null = null
  let collectingFlow = false
  let collectingBlockList = false
  const flowLines: string[] = []
  const blockImages: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#'))
      continue

    const titleMatch = line.match(/^title\s*:\s*(.*?)\s*$/i)
    if (titleMatch) {
      title = parseScalar(titleMatch[1])
      collectingBlockList = false
      continue
    }

    const imagesMatch = line.match(/^images\s*:\s*(.*?)\s*$/i)
    if (imagesMatch) {
      if (imageValue !== null)
        return null
      imageValue = imagesMatch[1]
      collectingBlockList = !imageValue
      collectingFlow = imageValue.startsWith('[')
      if (collectingFlow)
        flowLines.push(imageValue)
      continue
    }

    if (collectingFlow) {
      flowLines.push(line)
      if (line.includes(']'))
        collectingFlow = false
      continue
    }

    if (collectingBlockList) {
      const itemMatch = line.match(/^[-][ \t]*(.+)$/)
      if (!itemMatch)
        return null
      const value = parseScalar(itemMatch[1])
      if (!value)
        return null
      blockImages.push(value)
      continue
    }

    return null
  }

  let images: string[] | null = null
  if (imageValue?.startsWith('['))
    images = parseFlowList(flowLines.join('\n'))
  else if (imageValue === '')
    images = blockImages.length ? blockImages : null
  else if (imageValue !== null)
    images = [parseScalar(imageValue)]

  if (!images?.length || images.some(image => !IMAGE_EXTENSION.test(image)))
    return null

  return { title, images: [...new Set(images)] }
}

export function extractGalleryBlocks(markdown: string): { text: string, galleries: ParsedGalleryBlock[] } {
  const lines = markdown.split(/\r?\n/)
  const remaining: string[] = []
  const galleries: ParsedGalleryBlock[] = []

  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*```gallery\s*$/i.test(lines[index])) {
      remaining.push(lines[index])
      continue
    }

    const blockLines = [lines[index]]
    const body: string[] = []
    let endIndex = index + 1
    while (endIndex < lines.length && !/^\s*```\s*$/.test(lines[endIndex])) {
      body.push(lines[endIndex])
      blockLines.push(lines[endIndex])
      endIndex++
    }

    if (endIndex >= lines.length) {
      remaining.push(...lines.slice(index))
      break
    }

    blockLines.push(lines[endIndex])
    const gallery = parseGalleryBlock(body.join('\n'))
    if (gallery)
      galleries.push(gallery)
    else
      remaining.push(...blockLines)

    index = endIndex
  }

  return { text: remaining.join('\n'), galleries }
}
