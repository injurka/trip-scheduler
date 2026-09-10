import { describe, expect, it } from 'bun:test'
import { classifyTransportText } from '../lib/transport-classifier'

describe('classifyTransportText', () => {
  it('раскладывает переезды по разделам и пометкам', () => {
    expect(classifyTransportText('⛴️ Скоростной паром Dongliu Express')).toMatchObject({ type: 'other', kind: 'ferry' })
    expect(classifyTransportText('🚌 Шаттл Taiwan Tourist Shuttle 6670')).toMatchObject({ type: 'car', kind: 'bus' })
    expect(classifyTransportText('🚖 Шаттл / такси к причалу')).toMatchObject({ type: 'car', kind: 'taxi' })
    expect(classifyTransportText('🚙 Внедорожник 4WD / Минивэн (с гидом)')).toMatchObject({ type: 'car', kind: 'chauffeur' })
    expect(classifyTransportText('🚐 Прямой трансфер в аэропорт')).toMatchObject({ type: 'car', kind: 'transfer' })
    expect(classifyTransportText('🚗 Аренда авто, Klook')).toMatchObject({ type: 'car', kind: 'rental' })
    expect(classifyTransportText('🛵 Электробайк (E-bike, без прав)')).toMatchObject({ type: 'other', kind: 'bike' })
    expect(classifyTransportText('🚡 Канатная дорога на Сопку')).toMatchObject({ type: 'other', kind: 'cablecar' })
    expect(classifyTransportText('🚄 Сверхскоростной поезд THSR')).toMatchObject({ type: 'train' })
    expect(classifyTransportText('🚆 Поезд TRA (EMU3000)')).toMatchObject({ type: 'train' })
  })

  it('городское такси остаётся такси, автобус — автобусом', () => {
    expect(classifyTransportText('🚖 Яндекс Go (Комфорт)')).toMatchObject({ type: 'car', kind: 'taxi' })
    expect(classifyTransportText('🚌 Автобус 7322')).toMatchObject({ type: 'car', kind: 'bus' })
  })

  it('неопознанный переезд уходит в «Другое», а не в «Авто» или «Поезда»', () => {
    const target = classifyTransportText('🛷 Сани-волокуши за снегоходом')
    expect(target).toMatchObject({ type: 'other', kind: 'other', matched: false })
  })
})
