/** Readable calendar descriptions; keep paragraphs, list structure and link targets. */
export function calendarPlainText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*```[^\n]*\n|^\s*```\s*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^\s*>\s*\[![^\]]+\][+-]?\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+\[([ x])\]\s*/gim, (_, checked: string) => checked === ' ' ? '☐ ' : '☑ ')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\*+|~~/g, '')
    .replace(/__([^\n]+?)__/g, '$1')
    .replace(/\b_([^\n_]+)_\b/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
