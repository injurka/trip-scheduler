import { describe, expect, it } from 'bun:test'
import { convertActivityDocumentLinks, convertDocumentLinks } from '../lib/document-links'
import { parseActivitiesFromMarkdown } from '../parsers/activity'

const root = '/vault'
const folder = '00 - Файлы и документы/PrivateDocument/Транспорт/EasyCard и Airport MRT'
const files = ['Voucher EasyCard и Airport MRT QR.png', 'Чек Trip.com EasyCard и Airport MRT.pdf', 'Инструкция получения Ezfly.png']
const documents = files.map((name, i) => ({ filePath: `${root}/${folder}/${name}`, url: `trips/trip-1/documents/file-${i}.${name.split('.').pop()}` }))
const labels = ['Ваучер с QR-кодом', 'Чек', 'Инструкция выдачи']
const text = `Документы: ${files.map((name, i) => `[[${folder}/${name}|${labels[i]}]]`).join(' · ')}. EasyCard уже имеет стартовый баланс 200 TWD, далее пополнять по мере расходования.`

describe('imported document links', () => {
  it('takes the supplied activity through parsing and conversion', () => {
    const activity = parseActivitiesFromMarkdown(`* **14:15 - 15:30** — **Прилет в Таоюань**:\n  * ${text}`)[0]!
    const sections = convertActivityDocumentLinks(activity, root, documents)
    const description = sections?.find(section => section.type === 'description')
    expect(description?.type).toBe('description')
    if (description?.type !== 'description')
      throw new Error('Missing description')
    for (const [i, doc] of documents.entries()) {
      const href = `#trip-document=${encodeURIComponent(doc.url)}`
      expect(description.text).toContain(`[${labels[i]}](${href})`)
    }
    expect(description.text).toContain('EasyCard уже имеет стартовый баланс 200 TWD, далее пополнять по мере расходования.')
    expect(description.text).not.toContain('[[00 -')
    expect(description.text).not.toContain('token=')
  })

  it('resolves unique short paths and preserves missing, ambiguous, note and embedded links', () => {
    expect(convertDocumentLinks(`[[${files[0]}]]`, root, documents)).toStartWith(`[${files[0]}](#trip-document=`)
    const ambiguous = [...documents, { ...documents[0]!, filePath: `/vault/other/${files[0]}` }]
    const original = `[[${files[0]}|QR]] [[missing.pdf|Missing]] [[Заметка|Note]] ![[${folder}/${files[0]}]]`
    expect(convertDocumentLinks(original, root, ambiguous)).toBe(original)
    expect(convertDocumentLinks(`[[${folder}/${files[0]}|QR]]`, root, ambiguous)).toStartWith('[QR](#trip-document=')
    expect(convertDocumentLinks(text, root, [])).toBe(text)
  })

  it('preserves code examples and escapes aliases', () => {
    const link = `[[${folder}/${files[0]}|[QR]*]]`
    const code = `\`${link}\`\n\`\`\`md\n${text}\n\`\`\``
    expect(convertDocumentLinks(code, root, documents)).toBe(code)
    expect(convertDocumentLinks(link, root, documents)).toStartWith('[\\[QR\\]\\*](')
    const converted = convertDocumentLinks(text, root, documents)
    expect(convertDocumentLinks(converted, root, documents)).toBe(converted)
  })
})
