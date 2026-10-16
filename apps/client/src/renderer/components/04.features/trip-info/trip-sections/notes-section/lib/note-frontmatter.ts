/**
 * Свойства заметки (Obsidian frontmatter): разбор и обратная сборка.
 *
 * Файлы Obsidian-вольта импортируются в раздел «Заметки» как есть, вместе с
 * YAML-блоком в начале документа. Milkdown/Crepe такого блока не понимает и
 * рисует его сырым текстом, поэтому блок вырезается из содержимого редактора
 * и показывается отдельным блоком свойств (note-properties.vue).
 *
 * Разбор намеренно толерантный — поддерживается подмножество YAML, которое
 * встречается в вольте (скаляры, списки, блочные скаляры, вложенные карты),
 * а не полная спецификация. Схема ключей тоже открытая: незнакомый ключ
 * показывается как есть, а не отбрасывается.
 */

export type NotePropertyDisplay = 'text' | 'chips' | 'flag' | 'code' | 'image' | 'file'

export interface NoteProperty {
  /** Ключ свойства ровно как в YAML. */
  key: string
  /** Человекочитаемая подпись (для известных ключей — русская). */
  label: string
  display: NotePropertyDisplay
  /** Скалярное значение (для text / code / flag / image). */
  text: string
  /** Значения списка (для chips). */
  items: string[]
  /** Значение флага (для flag). */
  flag: boolean | null
  /** ISO-дата, если скаляр — дата вида 2026-11-04. */
  date: string | null
  /** Полное значение для подсказки — когда в блоке показывается только имя файла. */
  hint: string | null
}

export interface NoteFrontmatter {
  /** YAML-блок вместе с ограничителями, байт-в-байт — пишется обратно в заметку. */
  raw: string
  /** Содержимое заметки без блока свойств. */
  body: string
  properties: NoteProperty[]
}

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const BLOCK_SCALAR_PATTERN = /^[>|][-+]?$/
const KEY_START_PATTERN = /^[\p{L}\p{N}_]/u
const KEY_BODY_PATTERN = /^[\p{L}\p{N}_. -]+$/u
const FLAG_VALUES: Record<string, boolean> = { true: true, yes: true, false: false, no: false }

const IMAGE_KEYS = new Set(['cover', 'image', 'imageurl', 'banner', 'poster', 'thumbnail', 'preview'])
const START_DATE_KEYS = ['startdate', 'start_date', 'start']
const END_DATE_KEYS = ['enddate', 'end_date', 'end']

const PROPERTY_LABELS: Record<string, string> = {
  cover: 'Обложка',
  image: 'Изображение',
  imageurl: 'Обложка',
  banner: 'Обложка',
  poster: 'Обложка',
  thumbnail: 'Превью',
  slug: 'Slug',
  descriptionshort: 'Краткое описание',
  description: 'Описание',
  tags: 'Теги',
  cities: 'Города',
  country: 'Страна',
  countries: 'Страны',
  startdate: 'Начало',
  start_date: 'Начало',
  enddate: 'Окончание',
  end_date: 'Окончание',
  day: 'День',
  date: 'Дата',
  weekday: 'День недели',
  title: 'Заголовок',
  location: 'Локация',
  phase: 'Фаза',
  highlight: 'Хайлайт',
  accommodation: 'Жильё',
  hotel: 'Жильё',
  is_ready: 'Готовность',
  isready: 'Готовность',
  ready: 'Готовность',
  budget: 'Бюджет',
  currency: 'Валюта',
  address: 'Адрес',
  phone: 'Телефон',
  url: 'Ссылка',
  link: 'Ссылка',
  author: 'Автор',
  aliases: 'Синонимы',
  source: 'Источник',
  created: 'Создано',
  updated: 'Изменено',
}

const IMAGE_PATH_PREFIXES = ['avatars/', 'covers/', 'trips/', 'notes/', 'blog/', 'documents/', 'images/']
const IMAGE_FILE_PATTERN = /\.(?:png|jpe?g|webp|gif|avif|svg|bmp)$/i

interface RawEntry {
  key: string
  inline: string
  block: string[]
}

/** Отделяет YAML-блок свойств от содержимого заметки. */
export function splitNoteFrontmatter(content: string | null | undefined): { raw: string, body: string } {
  const source = content ?? ''
  const match = FRONTMATTER_PATTERN.exec(source)
  if (!match)
    return { raw: '', body: source }

  return { raw: match[0], body: source.slice(match[0].length) }
}

/** Собирает содержимое заметки обратно: блок свойств + текст. */
export function composeNoteContent(raw: string, body: string): string {
  return raw ? `${raw}${body}` : body
}

export function readNoteFrontmatter(content: string | null | undefined): NoteFrontmatter {
  const { raw, body } = splitNoteFrontmatter(content)
  return { raw, body, properties: raw ? parseNoteFrontmatter(raw) : [] }
}

/** Разбирает YAML-блок (вместе с ограничителями) в список свойств. */
export function parseNoteFrontmatter(raw: string): NoteProperty[] {
  const match = FRONTMATTER_PATTERN.exec(raw)
  const yaml = match ? match[1] : raw
  if (!yaml)
    return []

  return readEntries(yaml)
    .map(toProperty)
    .filter((property): property is NoteProperty => property !== null)
}

/** Ссылка на изображение, которое умеет отдать наш API (в отличие от локального пути вольта). */
export function isRemoteImageReference(value: string): boolean {
  if (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value))
    return true
  return IMAGE_PATH_PREFIXES.some(prefix => value.toLowerCase().startsWith(prefix))
}

/** Имя файла без пути вольта — для компактного показа ссылки на изображение. */
function fileNameOf(value: string): string {
  const segments = value.split(/[\\/]/)
  return segments[segments.length - 1] || value
}

/** «26 дней · 25 ночей» по свойствам начала и окончания; null, если дат нет. */
export function describeDateRange(properties: NoteProperty[]): string | null {
  const start = findDateProperty(properties, START_DATE_KEYS)
  const end = findDateProperty(properties, END_DATE_KEYS)
  if (start === null || end === null || end < start)
    return null

  const days = Math.round((end - start) / 86_400_000) + 1
  const nights = days - 1
  const parts = [`${days} ${plural(days, 'день', 'дня', 'дней')}`]
  if (nights > 0)
    parts.push(`${nights} ${plural(nights, 'ночь', 'ночи', 'ночей')}`)

  return parts.join(' · ')
}

function findDateProperty(properties: NoteProperty[], keys: string[]): number | null {
  const property = properties.find(item => keys.includes(item.key.toLowerCase()))
  return property?.date ? toUtcTimestamp(property.date) : null
}

function toUtcTimestamp(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match)
    return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14)
    return many
  const mod10 = count % 10
  if (mod10 === 1)
    return one
  if (mod10 >= 2 && mod10 <= 4)
    return few
  return many
}

function readEntries(yaml: string): RawEntry[] {
  const lines = yaml.split(/\r?\n/)
  const entries: RawEntry[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const entry = /^\S/.test(line) ? parsePropertyLine(line) : null
    if (!entry) {
      index += 1
      continue
    }

    const block: string[] = []
    let next = index + 1
    while (next < lines.length && isBlockLine(lines[next] ?? '')) {
      block.push(lines[next] ?? '')
      next += 1
    }

    entries.push({ key: entry.key, inline: entry.value, block })
    index = next
  }

  return entries
}

/** Разбирает строку «ключ: значение» верхнего уровня; null для остального. */
function parsePropertyLine(line: string): { key: string, value: string } | null {
  const colonIndex = line.indexOf(':')
  if (colonIndex <= 0)
    return null

  const key = line.slice(0, colonIndex)
  if (!KEY_START_PATTERN.test(key) || !KEY_BODY_PATTERN.test(key))
    return null

  return { key, value: line.slice(colonIndex + 1).trim() }
}

/** Строка продолжения свойства: отступ или элемент списка. */
function isBlockLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed)
    return false
  return /^\s/.test(line) || trimmed.startsWith('-')
}

/** Значение элемента списка («- Тайбэй»), либо null. */
function readListItem(line: string): string | null {
  const trimmed = line.trimStart()
  if (!trimmed.startsWith('-'))
    return null

  const rest = trimmed.slice(1)
  if (!rest.startsWith(' ') && !rest.startsWith('\t'))
    return null

  const item = rest.trim()
  return item.length > 0 ? item : null
}

function toProperty(entry: RawEntry): NoteProperty | null {
  const key = entry.key
  const label = labelFor(key)
  const inline = cleanScalar(entry.inline)

  if (BLOCK_SCALAR_PATTERN.test(entry.inline)) {
    const separator = entry.inline.startsWith('|') ? '\n' : ' '
    return buildProperty(key, label, entry.block.map(line => line.trim()).join(separator))
  }

  if (inline.startsWith('[') && inline.endsWith(']')) {
    const items = parseInlineArray(inline)
    if (items.length)
      return buildProperty(key, label, items.join(', '), { display: 'chips', items })
  }

  const listItems = entry.block
    .map(readListItem)
    .filter((item): item is string => item !== null)
    .map(cleanScalar)
    .filter(Boolean)
  if (listItems.length)
    return buildProperty(key, label, listItems.join(', '), { display: 'chips', items: listItems })

  if (!inline) {
    const nested = entry.block.map(line => line.trim()).filter(Boolean)
    if (!nested.length)
      return null
    return buildProperty(key, label, nested.join('\n'), { display: 'code' })
  }

  const flag = FLAG_VALUES[inline.toLowerCase()]
  if (flag !== undefined)
    return buildProperty(key, label, inline, { display: 'flag', flag })

  const isImage = IMAGE_KEYS.has(key.toLowerCase())
  if (isImage && isRemoteImageReference(inline))
    return buildProperty(key, label, inline, { display: 'image' })

  // Путь картинки из вольта (`_/03/20260825143131.png`) наш API отдать не может:
  // показываем имя файла, полное значение остаётся в подсказке.
  if (isImage && IMAGE_FILE_PATTERN.test(inline))
    return buildProperty(key, label, fileNameOf(inline), { display: 'file', hint: inline })

  return buildProperty(key, label, inline, {
    date: DATE_PATTERN.test(inline) ? inline : null,
  })
}

function buildProperty(
  key: string,
  label: string,
  text: string,
  extra: Partial<NoteProperty> = {},
): NoteProperty {
  return {
    key,
    label,
    display: extra.display ?? 'text',
    text,
    items: extra.items ?? [],
    flag: extra.flag ?? null,
    date: extra.date ?? null,
    hint: extra.hint ?? null,
  }
}

function labelFor(key: string): string {
  return PROPERTY_LABELS[key.toLowerCase()] ?? key
}

/** Снимает кавычки, обёртку вики-ссылки и псевдоним внутри неё. */
function cleanScalar(value: string): string {
  let result = value.trim()
  const wrapped = /^!?\[\[(.+?)\]\]$/.exec(result)
  if (wrapped)
    result = (wrapped[1] ?? '').split('|')[0]?.trim() ?? ''
  const quote = result[0]
  if ((quote === '"' || quote === '\'') && result.endsWith(quote) && result.length > 1)
    result = result.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, '\'')
  return result.trim()
}

function parseInlineArray(value: string): string[] {
  const items: string[] = []
  let current = ''
  let quote: '"' | '\'' | null = null

  for (const char of value.slice(1, -1)) {
    if ((char === '"' || char === '\'') && (!quote || quote === char)) {
      quote = quote === char ? null : char
      current += char
    }
    else if (char === ',' && !quote) {
      items.push(cleanScalar(current))
      current = ''
    }
    else {
      current += char
    }
  }
  items.push(cleanScalar(current))

  return items.map(item => item.trim()).filter(Boolean)
}
