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

  it('сохраняет дополнительные колонки и извлекает точные часы, включая переход через полночь', () => {
    const exact = parseTransportMarkdown(`
| Дата | Переезд | Транспорт | Время | Статус | Следующее действие |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **03 ноя (Вт) ➔ 04 ноя (Ср)** | Ульяновск ➔ Москва | 🚆 Поезд ФПК | **20:45–09:56** | ✅ Куплено | Сохранить PDF офлайн |
| **21 ноя** | Donggang ➔ Xiaoliuqiu | ⛴️ Tungliu | **10:00–10:20** | ⚠️ Проверить | Следующий рейс — Plan B |
`, '2026-11-04')

    expect(exact).toHaveLength(2)
    expect(exact[0]).toMatchObject({
      type: 'train',
      data: {
        departureDateTime: '2026-11-03T20:45:00',
        arrivalDateTime: '2026-11-04T09:56:00',
      },
    })
    expect(exact[0].data.notes).toContain('Сохранить PDF офлайн')
    expect(exact[1]).toMatchObject({
      type: 'other',
      data: {
        startDateTime: '2026-11-21T10:00:00',
        endDateTime: '2026-11-21T10:20:00',
      },
    })
  })
})

it('does not invent clocks or read deadlines as transport times', () => {
  const result = parseTransportMarkdown(`
| Дата | Переезд | Транспорт | Время | Статус |
| --- | --- | --- | --- | --- |
| 04 ноя | Казанская ➔ SVO | 🚖 Такси или 🚇 Аэроэкспресс | 1–2 ч | До 20:15 |
| 05 ноя | CAN-T2 ➔ Pearl Hotel | Транзитный шаттл China Southern | 22 ч стыковки | Уточнить |
| 29 ноя | SVO ➔ Москва Казанская | 🚖 Такси | После прилёта в 13:00; поезд в 18:08 | План |
| 21 ноя | Donggang ➔ Xiaoliuqiu | ⛴️ Tungliu | около 11:30 | План |
`, '2026-11-04')
  expect(result).toHaveLength(4)
  expect(result[0]).toMatchObject({ type: 'car', data: { pickupDateTime: '2026-11-04', dropoffDateTime: undefined } })
  expect(result[1]).toMatchObject({ type: 'car', data: { kind: 'transfer', pickupDateTime: '2026-11-05', dropoffDateTime: undefined } })
  expect(result[2]).toMatchObject({ type: 'car', data: { pickupDateTime: '2026-11-29', dropoffDateTime: undefined } })
  expect(result[3]).toMatchObject({ type: 'other', data: { startDateTime: '2026-11-21T11:30:00', endDateTime: undefined } })
})

it('imports pre-segments and station-local times, train number, carriage and seat', () => {
  const result = parseTransportMarkdown(`
| Дата | Переезд | Транспорт | Время | Статус | Примечание |
| --- | --- | --- | --- | --- | --- |
| Пре-сегмент (03–04 ноя) | Ульяновск Центр. ➔ Москва Казанская | 🚂 ФПК | 20:45–09:56 | Куплено | PDF |
| 29 ноя ➔ 30 ноя | Москва Казанская ➔ Ульяновск Центр. | 🚂 ФПК №022 | 18:08–08:30 | Куплено | вагон 03, место 024 |
| 13 ноя | Banqiao → Chiayi | 🚄 THSR №0821 | 11:19–12:54 | План | |
`, '2026-11-04')
  expect(result).toHaveLength(3)
  expect(result[0]).toMatchObject({ type: 'train', data: { departureDateTime: '2026-11-03T20:45:00', arrivalDateTime: '2026-11-04T09:56:00', departureTimeZone: '+04:00', arrivalTimeZone: '+03:00' } })
  expect(result[1]).toMatchObject({ type: 'train', data: { departureDateTime: '2026-11-29T18:08:00', arrivalDateTime: '2026-11-30T08:30:00', trainNumber: '022', carriage: '03', seat: '024' } })
  expect(result[2]).toMatchObject({ type: 'train', data: { departureStation: 'Banqiao', arrivalStation: 'Chiayi', departureTimeZone: '+08:00', arrivalTimeZone: '+08:00' } })
})

it('ignores marked reference tables and action checklists', () => {
  const result = parseTransportMarkdown(`
| Когда | Сегмент | Статус | Действие |
| --- | --- | --- | --- |
| Сейчас | A ➔ B | Куплено | PDF |
<!-- bookings:ignore -->

| Дата | Переезд | Транспорт | Время | Статус |
| --- | --- | --- | --- | --- |
| 11 ноя | Хуалянь ➔ Chongde | 🚆 TRA | 13:25–13:46 | План |

| Дата | Переезд | Транспорт | Время | Статус |
| --- | --- | --- | --- | --- |
| 11 ноя | Chongde ➔ Хуалянь | 🚆 TRA №4552 | 17:27–17:52 | План |
`, '2026-11-04')
  expect(result).toHaveLength(1)
  expect(result[0].title).toBe('Chongde ➔ Хуалянь')
})
