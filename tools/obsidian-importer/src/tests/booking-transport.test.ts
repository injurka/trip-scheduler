import { describe, expect, it } from 'bun:test'
import { parseTransportMarkdown } from '../parsers/booking'

/**
 * Проверяем раскладку строк `Транспорт.md` по разделам платформы:
 * «Авто» (`car`) — только автомобильный транспорт, «Другое» (`other`) —
 * паромы, катера, канатные дороги, велосипеды и прочие перемещения.
 * Каждая запись «Авто»/«Другое» должна нести пометку `kind`.
 */
const markdown = `
## 📋 График междугороднего транспорта и экскурсий

|  День  | Дата / День нед. | Сегмент                                             |             Транспорт             |  Время в пути  | Способ бронирования / Оплата                           |
| :----: | :--------------: | :-------------------------------------------------- | :-------------------------------: | :------------: | :----------------------------------------------------- |
| **01** | **20 янв (Ср)**  | Аэропорт MMK ➔ Отель Azimut (Центр)                 |      🚖 Яндекс Go (Комфорт)       |     35 мин     | В приложении по прилету (~1 200 ₽)                     |
| **01** | **20 янв (Ср)**  | Мурманск ➔ Тундра (Охота за Авророй) ➔ Отель        |   🚙 Внедорожник 4WD / Минивэн    |   4–6 часов    | Онлайн у гида-астронома (~5 000 ₽)                     |
| **02** | **21 янв (Чт)**  | Морвокзал ➔ Сопка Зеленый Мыс                       |      🚡 Канатная дорога           |     15 мин     | На месте (~300 ₽)                                      |
| **02** | **21 янв (Чт)**  | Лодейное ➔ Пляж «Яйца Дракона» ➔ Водопад            | 🛷 Сани-волокуши за снегоходом     |      2–3 часа     | На месте в Лодейном / в туре (~1 800 ₽)                |
| **03** | **22 янв (Пт)**  | *(Опция)* Выход в Баренцево море (Whale Watching)   | 🚢 Морской катер / бот             |      2–2.5 часа   | В Териберке при благоприятной погоде (~4 500 ₽)        |
| **03** | **22 янв (Пт)**  | Аэропорт Мурманск ➔ Териберка                       | 🚌 Горный автобус                   |      2 часа       | На месте (~600 ₽)                                      |
| **03** | **22 янв (Пт)**  | Пирс ➔ Остров Кильдин                              | ⛴ Паром                             |      1 час        | Онлайн на сайте оператора (~900 ₽)                     |
| **04** | **23 янв (Сб)**  | Отель ➔ Саамская деревня «Самь-Сыйт»               | 🚐 Туристический минивэн с багажом |   1 ч 30 мин   | Онлайн на sam-syit.ru (~3 500 ₽)                      |
| **04** | **23 янв (Сб)**  | Саамская деревня ➔ Аэропорт Мурманск (MMK)          |  🚐 Прямой трансфер в аэропорт     |   1 ч 15 мин   | В составе тура на sam-syit.ru (~3 500 ₽)              |
| **04** | **23 янв (Сб)**  | Прогулка по набережной Тайваня                     | 🚲 Электровелосипед                |     40 мин     | В приложении YouBike (~200 ₽)                          |
| **04** | **23 янв (Сб)**  | Аэропорт ➔ Отель (забрать авто)                    | 🚗 Аренда авто                      |     20 мин     | Онлайн на rentalcars.com (~4 000 ₽/сутки)              |
`

const bookings = parseTransportMarkdown(markdown, '2026-01-20')

function pick(fragment: string) {
  const found = bookings.find(b => b.title.includes(fragment) || JSON.stringify(b.data).includes(fragment))
  if (!found)
    throw new Error(`Запись «${fragment}» не распознана. Есть: ${bookings.map(b => b.title).join(' | ')}`)
  return found
}

describe('Transport Booking Parser · разделы «Авто» и «Другое»', () => {
  it('раскладывает перемещения по типам car/train/other', () => {
    const types = bookings.map(b => b.type)
    expect(types).toContain('car')
    expect(types).toContain('other')
    expect(bookings).toHaveLength(11)
  })

  it('городское такси без аэропорта по-прежнему пропускается как шум', () => {
    const cityOnly = parseTransportMarkdown(`
|  День  | Дата / День нед. | Сегмент | Транспорт | Время | Оплата |
| :----: | :--------------: | :------ | :-------: | :---: | :----- |
| **01** | **20 янв (Ср)**  | Отель ➔ Морвокзал | 🚖 Яндекс Go | 10 мин | ~250 ₽ |
| **01** | **20 янв (Ср)**  | Отель ➔ Аэропорт MMK | 🚖 Яндекс Go | 40 мин | ~1 200 ₽ |
`, '2026-01-20')
    expect(cityOnly).toHaveLength(1)
    expect(cityOnly[0]).toMatchObject({ type: 'car', data: { kind: 'taxi' } })
  })

  it('такси, трансфер, аренда, авто с водителем и автобус — раздел «Авто» с пометками', () => {
    expect(pick('Яндекс Go (Комфорт)')).toMatchObject({ type: 'car', data: { kind: 'taxi' } })
    expect(pick('Прямой трансфер')).toMatchObject({ type: 'car', data: { kind: 'transfer' } })
    expect(pick('Аренда авто')).toMatchObject({ type: 'car', data: { kind: 'rental' } })
    expect(pick('Горный автобус')).toMatchObject({ type: 'car', data: { kind: 'bus' } })
    expect(pick('Внедорожник 4WD / Минивэн')).toMatchObject({ type: 'car', data: { kind: 'chauffeur' } })
    expect(pick('Туристический минивэн с багажом')).toMatchObject({ type: 'car', data: { kind: 'chauffeur' } })
  })

  it('паром, катер, велосипед и снегоходные сани — раздел «Другое» с пометками', () => {
    const ferry = pick('⛴ Паром')
    expect(ferry).toMatchObject({ type: 'other', data: { kind: 'ferry' } })
    if (ferry.type === 'other')
      expect(ferry.data.name).toContain('Паром')

    expect(pick('Морской катер')).toMatchObject({ type: 'other', data: { kind: 'boat' } })
    expect(pick('🚡 Канатная дорога')).toMatchObject({ type: 'other', data: { kind: 'cablecar' } })
    expect(pick('Электровелосипед')).toMatchObject({ type: 'other', data: { kind: 'bike' } })
    expect(pick('Сани-волокуши')).toMatchObject({ type: 'other' })
  })

  it('в разделе «Другое» заполнены маршрут и названия перемещения', () => {
    const ferry = pick('⛴ Паром')
    expect(ferry.title).toBe('Пирс ➔ Остров Кильдин')
    if (ferry.type === 'other') {
      expect(ferry.data.startLocation).toBe('Пирс')
      expect(ferry.data.endLocation).toBe('Остров Кильдин')
      expect(ferry.data.startDateTime).toStartWith('2026-01-')
    }
  })

  it('записи «Авто»/«Другое» всегда имеют иконку и не попадают в «Поезда»', () => {
    for (const booking of bookings) {
      expect(booking.icon).toStartWith('mdi:')
      if (booking.type === 'car' || booking.type === 'other')
        expect(booking).not.toHaveProperty('data.segments')
    }
  })
})
