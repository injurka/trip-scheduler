import type { Transport } from '../lib/transport'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { parseCliArgs } from '../cli/args'
import { buildImageIndex } from '../lib/image-indexer'
import { importTripFolderCore } from '../lib/import-trip'
import { parseTransportMarkdown } from '../parsers/booking'
import { parseObsidianChecklists } from '../parsers/checklist'
import { parseDayMetaFromMarkdown } from '../parsers/day-meta'
import { parseObsidianFinances } from '../parsers/finances'
import { resolveValidationScopeContext, validateObsidianVault } from '../validator'

const temporaryDirectories: string[] = []

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('importer regressions', () => {
  it('rejects unknown CLI options and missing values', () => {
    expect(() => parseCliArgs(['--non-interactive'])).toThrow('Неизвестная опция')
    expect(() => parseCliArgs(['--dir'])).toThrow('требуется значение')
  })

  it('parses calendar transport dates and does not discard data containing the word маршрут', () => {
    const markdown = `
| Дата...День | Сегмент | Транспорт | Время в пути | Оплата |
| :---: | :--- | :--- | :---: | :--- |
| **30 окт (Пт)** | Аэропорт TPE ➔ Тайбэй | 🚇 Taoyuan Express MRT | 35 мин | EasyCard |
| **06 ноя (Пт)** | THSR Taichung ➔ Sun Moon Lake | 🚌 Шаттл Taiwan Tourist Shuttle 6670 | 1 ч 20 мин | [Официальный маршрут](https://example.com/route) |
`
    const first = parseTransportMarkdown(markdown, '2026-10-29')
    const second = parseTransportMarkdown(markdown, '2026-10-29')

    expect(first).toHaveLength(2)
    expect(first.map(booking => booking.id)).toEqual(second.map(booking => booking.id))
    expect(first[0]).toMatchObject({
      type: 'train',
      data: { departureDateTime: '2026-10-30T09:00:00', departureTimeZone: '+08:00' },
    })
    expect(first[1]).toMatchObject({
      type: 'car',
      data: { pickupDateTime: '2026-11-06T09:00:00', kind: 'bus', pickupTimeZone: '+08:00' },
    })
  })

  it('uses one authoritative summary budget without counting detail tables twice', () => {
    const directory = temporaryDirectory('obsidian-finances-')
    const file = join(directory, 'Финансы.md')
    writeFileSync(file, `
> [!summary]+ Общий бюджет: **195 624 ₽**
> - ✈️ **Международный авиаперелет:** \`62 793 ₽\`
> - 🛂 **Визовый сбор:** \`4 800 ₽\`
> - 🏨 **Проживание:** \`68 511 ₽\`
> - 🚄 **Внутренний транспорт:** \`32 020 ₽\`
> - 🍜 **Ежедневное питание:** \`18 500 ₽\`
> - 🎟️ **Билеты и активности:** \`4 000 ₽\`
> - 🎁 **Сувениры и подарки:** \`5 000 ₽\`

| Статья | Стоимость |
| :--- | :---: |
| Дублирующая авиастрока | 62 793 ₽ |
`)

    const finances = parseObsidianFinances(file)
    expect(finances.transactions).toHaveLength(7)
    expect(finances.transactions.reduce((sum, item) => sum + item.amount, 0)).toBe(195624)
    expect(finances.transactions.find(item => item.amount === 18500)?.categoryId).toBe('cat-food')
    expect(finances.transactions.map(item => item.id)).toEqual(parseObsidianFinances(file).transactions.map(item => item.id))
  })

  it('marks duplicate image basenames as ambiguous while retaining relative paths', () => {
    const directory = temporaryDirectory('obsidian-images-')
    mkdirSync(join(directory, '_', '01'), { recursive: true })
    mkdirSync(join(directory, '_', '02'), { recursive: true })
    writeFileSync(join(directory, '_', '01', 'same.jpg'), 'one')
    writeFileSync(join(directory, '_', '02', 'same.jpg'), 'two')

    const index = buildImageIndex(directory)
    expect(index.get('same.jpg')).toBe('')
    expect(index.get('_/01/same.jpg')).toBe(join(directory, '_', '01', 'same.jpg'))
    expect(index.get('_/02/same.jpg')).toBe(join(directory, '_', '02', 'same.jpg'))
  })

  it('keeps day metadata and checklist identities stable across repeated parsing', () => {
    const day = '> [!TIP]\n> Купить EasyCard\n\n* **09:00 - 10:00** — **Прогулка**:'
    expect(parseDayMetaFromMarkdown(day)).toEqual(parseDayMetaFromMarkdown(day))

    const directory = temporaryDirectory('obsidian-checklist-')
    const file = join(directory, 'Чек-лист.md')
    writeFileSync(file, '## Документы\n- [ ] Паспорт\n  - [ ] Сделать копию')
    expect(parseObsidianChecklists([file])).toEqual(parseObsidianChecklists([file]))
  })

  it('rolls back a programmatic trip when a required import stage fails', async () => {
    const directory = temporaryDirectory('obsidian-core-')
    mkdirSync(join(directory, '02 - Маршрутный план'))
    writeFileSync(join(directory, 'Trip.md'), '# Trip\n\n## 📝 Краткое описание\n\nTest trip description.')
    writeFileSync(join(directory, '02 - Маршрутный план', '01 Day.md'), '* **09:00 - 10:00** — **Walk**:\n  * Description')

    const deletedTrips: string[] = []
    const transport: Transport = {
      createTrip: async payload => ({ id: 'trip-1', title: payload.title }),
      updateTrip: async () => undefined,
      deleteTrip: async (id) => { deletedTrips.push(id) },
      getTripDetails: async () => ({ sections: [] }),
      getDaysByTripId: async () => [],
      createDay: async payload => ({ id: 'day-1', title: payload.title }),
      updateDay: async () => undefined,
      deleteDay: async () => undefined,
      createActivity: async () => { throw new Error('activity write failed') },
      createTripSection: async () => undefined,
      updateTripSection: async () => undefined,
      createNote: async payload => ({ id: 'note-1', title: payload.title }),
      updateNote: async () => undefined,
    }

    await expect(importTripFolderCore(directory, transport, {
      useLlm: false,
      uploadImages: false,
      geocode: false,
      importNotes: false,
      importSections: false,
    })).rejects.toThrow('activity write failed')
    expect(deletedTrips).toEqual(['trip-1'])
  })

  it('blocks import when semantic booking dates or budget totals are invalid', () => {
    const directory = temporaryDirectory('-- Invalid-trip-')
    mkdirSync(join(directory, '02 - Маршрутный план'))
    mkdirSync(join(directory, '03 - Бронирования'))
    mkdirSync(join(directory, '04 - Финансы'))
    writeFileSync(join(directory, 'Invalid trip.md'), '# Invalid trip\n\n## 📝 Краткое описание\n\nОписание тестовой поездки.\n')
    writeFileSync(join(directory, '02 - Маршрутный план', '01 City.md'), '* **09:00 - 10:00** — **Walk**:\n  * Description')
    writeFileSync(join(directory, '03 - Бронирования', 'Транспорт.md'), `
| Дата | Сегмент | Транспорт | Время | Оплата |
| :---: | :--- | :--- | :---: | :--- |
| **30 дек** | City A ➔ City B | 🚆 Поезд | 1 час | касса |
`)
    writeFileSync(join(directory, '04 - Финансы', 'Финансы.md'), `
> [!summary]+ Общий бюджет: **2 000 ₽**
> - 🚄 **Транспорт:** \`1 000 ₽\`
`)

    const report = validateObsidianVault(resolveValidationScopeContext(directory), '2026-10-29')
    expect(report.readinessSummary.canImport).toBeFalse()
    expect(report.issues.some(issue => issue.severity === 'error' && issue.category === 'bookings')).toBeTrue()
    expect(report.issues.some(issue => issue.severity === 'error' && issue.category === 'finances')).toBeTrue()
  })
})
