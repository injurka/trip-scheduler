/**
 * Формирует безопасный заголовок Content-Disposition.
 * HTTP-заголовки допускают только ByteString (Latin-1), поэтому кириллица и эмодзи в
 * `filename="..."` приводят к `TypeError: Header 'Content-Disposition' has invalid value`.
 * Используем ASCII-фоллбэк в `filename` и полное имя в `filename*` (RFC 5987 / RFC 6266).
 */
export function buildContentDisposition(disposition: 'inline' | 'attachment', filename: string): string {
  const asciiFallback = filename
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+(?=\.)|^_+$/g, '')
    || 'file'

  const encoded = encodeURIComponent(filename).replace(/['()*]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}
