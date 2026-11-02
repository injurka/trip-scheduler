import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { buildDayKeywordMap, parseObsidianFinances, resolveDateFromText } from '../parsers/finances'
import { resolveValidationScopeContext, validateObsidianVault } from '../validator'

const directories: string[] = []

function fixture(markdown: string): { root: string, file: string } {
  const root = mkdtempSync(join(tmpdir(), 'finances-regression-'))
  directories.push(root)
  const file = join(root, 'Финансы.md')
  writeFileSync(file, markdown)
  return { root, file }
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('finance parsing', () => {
  it('respects explicit and negative payment statuses instead of incidental words', () => {
    const { root, file } = fixture(`
### 🚄 Транспорт
| Статья | Стоимость | Примечание |
| --- | --- | --- |
| Остальные региональные TRA | 1 070 ₽ | (план); без оплаченных плеч |
| Паром | 947,71 ₽ | Оплачено онлайн |
| Запасной автобус | 100 ₽ | Статус: план; предыдущий поезд оплачен |
| Другой автобус | 200 ₽ | unpaid |
| Трансфер | 300 ₽ | not paid |
| Билет | 400 ₽ | paid |
| Ещё билет | 500 ₽ | online |
### 🎟️ Входные билеты
* Национальный лесной парк Алишань: пока не оплачен, ~420–840 ₽.
* Другой парк: неоплачено, 100 ₽.
`)
    const { transactions } = parseObsidianFinances(file, root, '2026-11-04')
    expect(transactions.map(t => t.status)).toEqual([
      'planned',
      'paid',
      'planned',
      'planned',
      'planned',
      'paid',
      'paid',
      'planned',
      'planned',
    ])
    expect(transactions[1].amount).toBe(947.71)
    expect(transactions[7].amount).toBe(840)
  })

  it('keeps currency fractions and classifies Russian railway limits with train expenses', () => {
    const { root, file } = fixture(`
> [!summary]+ Общий бюджет: **8 459 ₽**
> - 🚂 **Железнодорожная дорога из дома и обратно:** 8 419 ₽
> - 📱 **Связь e-SIM:** 40,31 ₽
### 🚄 Транспорт
| Статья | Стоимость | Примечание |
| --- | --- | --- |
| Российские поезда | 8 419 ₽ | Оплачено |
### 📱 Связь
| Статья | Стоимость | Примечание |
| --- | --- | --- |
| eSIM Китай | 40,31 ₽ | Оплачено |
`)
    const result = parseObsidianFinances(file, root, '2026-11-04')
    expect(result.categories.find(c => c.id === 'cat-transport')?.budgetLimit).toBe(8419)
    expect(result.categories.find(c => c.id === 'cat-other')?.budgetLimit).toBeUndefined()
    expect(result.transactions.find(t => t.categoryId === 'cat-telecom')?.amount).toBe(40.31)
  })

  it('does not turn a daily reconciliation table into a second set of expenses', () => {
    const { root, file } = fixture(`
> [!summary]+ Общий бюджет: **101,31 ₽**
> - 🛂 **Прочее: визовый сбор и аварийный резерв:** 101,31 ₽
### 🛂 Прочее
| Статья | Стоимость | Примечание |
| --- | --- | --- |
| Аварийный резерв | 101,31 ₽ | Статус: план |
## Сверка с дневными файлами
| День | Транспорт | Еда | Итого |
| --- | --- | --- | --- |
| День 01 | 101,31 ₽ | 200 ₽ | 301,31 ₽ |
`)
    const result = parseObsidianFinances(file, root, '2026-11-04')
    expect(result.settings.totalBudget).toBe(101.31)
    expect(result.categories.find(c => c.id === 'cat-other')?.budgetLimit).toBe(101.31)
    expect(result.categories.find(c => c.id === 'cat-shopping')?.budgetLimit).toBeUndefined()
    expect(result.transactions).toHaveLength(1)
  })

  it('validates a declared budget with kopecks using the imported amount', () => {
    const { root } = fixture(`
> [!summary]+ Общий бюджет: **265 820,56 ₽**
> - 🚄 **Транспорт:** 265 820,56 ₽
`)
    const report = validateObsidianVault(resolveValidationScopeContext(root), '2026-11-04')
    expect(report.issues.some(issue => issue.severity === 'error' && issue.category === 'finances')).toBeFalse()
    expect(report.financesSummary.totalRub).toBe(265820.56)
  })

  it('uses explicit accounting dates and never reads Markdown bold numbers as day numbers', () => {
    expect(resolveDateFromText('**THSR №637** 2 800 ₽', '2026-11-04')).toBeUndefined()
    expect(resolveDateFromText('День 10, поезд', '2026-11-04')).toBe('2026-11-13')
    expect(resolveDateFromText('Поездка (13.11)', '2026-11-04')).toBe('2026-11-13')
    expect(resolveDateFromText('Поездка: 2026-11-13; Дата расхода: 2026-10-22', '2026-11-04')).toBe('2026-10-22')
    const { root, file } = fixture(`
### 🚄 Транспорт
| Статья | Стоимость | Примечание |
| --- | --- | --- |
| **THSR №637** | 2 800 ₽ | Дата расхода: 2026-11-13; оплата не датирована |
`)
    expect(parseObsidianFinances(file, root, '2026-11-04').transactions[0].date).toBe('2026-11-13')
  })

  it('does not assign dates from shared cities or generic itinerary title words', () => {
    const { root, file } = fixture(`
### 🚄 Транспорт
| Статья | Стоимость | Примечание |
| --- | --- | --- |
| Хуалянь, Local TRA | 200 ₽ | План |
| Другой автобус | 100 ₽ | Переезд, поздний вечер |
`)
    const days = join(root, '02 - Маршрутный план')
    mkdirSync(days)
    writeFileSync(join(days, '08 Хуалянь (ср) 🌊 Переезд и вечер.md'), '')
    writeFileSync(join(days, '09 Хуалянь (чт) Озеро и Local TRA.md'), '')
    expect(buildDayKeywordMap(days, '2026-11-04').has('хуалянь')).toBeFalse()
    expect(buildDayKeywordMap(days, '2026-11-04').has('переезд')).toBeFalse()
    expect(parseObsidianFinances(file, root, '2026-11-04').transactions.every(t => !t.date)).toBeTrue()
  })

  it('keeps prepaid food credit as a payment inside the food envelope without creating meal estimates', () => {
    const { root, file } = fixture(`
> [!summary]+ Общий бюджет: **40 000 ₽**
> - 🍜 **Питание:** 40 000 ₽
### 🍜 Питание
* Завтраки: 5 000 ₽.
| Статья | Стоимость | Примечание |
| --- | --- | --- |
| Предоплата 7-ELEVEN | 2 536,13 ₽ | Статус: оплачено; Дата расхода: 2026-10-20; включено в лимит питания |
| Остаток питания | 37 463,87 ₽ | Статус: план |
`)
    const result = parseObsidianFinances(file, root, '2026-11-04')
    expect(result.settings.totalBudget).toBe(40000)
    expect(result.categories.find(c => c.id === 'cat-food')?.budgetLimit).toBe(40000)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toMatchObject({ amount: 2536.13, status: 'paid', date: '2026-10-20' })
  })

  it('uses departure metadata for flights and does not infer payment from a booking URL', () => {
    const { root, file } = fixture('### ✈️ Международный авиаперелёт')
    const bookings = join(root, '03 - Бронирования')
    mkdirSync(bookings)
    writeFileSync(join(bookings, 'Авиаперелеты.md'), `
> Наземный поезд прибывает 3 ноября 2026.
> [!SUCCESS]+ Выбранный рейс: **China Southern**
> Стоимость: **55 412 ₽**
> Ссылка на заказ: https://trip.com/orderdetail
* **Дата отправления:** **4 ноября 2026**
`)
    const result = parseObsidianFinances(file, root, '2026-11-04')
    expect(result.transactions[0]).toMatchObject({ status: 'planned', date: '2026-11-04' })
  })
})
