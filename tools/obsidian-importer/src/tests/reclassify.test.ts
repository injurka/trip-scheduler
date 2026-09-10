import type { Booking, CarData, OtherData, TrainData } from '../types'
import { describe, expect, it } from 'bun:test'
import { reclassifyBookings } from '../lib/reclassify'

function train(id: string, title: string, icon: string, data: Partial<TrainData> = {}): Booking {
  return {
    id,
    type: 'train',
    icon,
    title,
    data: {
      departureStation: 'A',
      arrivalStation: 'B',
      departureDateTime: '2026-11-06T09:00:00',
      arrivalDateTime: '2026-11-06T12:00:00',
      departureTimeZone: '+03:00',
      arrivalTimeZone: '+03:00',
      ...data,
    },
  }
}

function car(id: string, title: string, icon: string, data: Partial<CarData> = {}): Booking {
  return {
    id,
    type: 'car',
    icon,
    title,
    data: {
      pickupLocation: 'A',
      dropoffLocation: 'B',
      pickupDateTime: '2026-11-06T09:00:00',
      dropoffDateTime: '2026-11-06T12:00:00',
      ...data,
    },
  }
}

describe('reclassifyBookings', () => {
  it('переносит автобус и паром из «Поездов» в «Авто» и «Другое»', () => {
    const { bookings, changes } = reclassifyBookings([
      train('1', 'THSR Taichung ➔ Sun Moon Lake (Шуйшэ)', 'mdi:bus', { notes: '🚌 Шаттл Taiwan Tourist Shuttle 6670. В пути ~1 ч 20 мин.' }),
      train('2', 'Порт Дунган ➔ Остров Сяолюцю', 'mdi:ferry', { notes: '⛴️ Скоростной паром Dongliu Express. 20 мин.' }),
    ])

    expect(bookings[0]).toMatchObject({ type: 'car', icon: 'mdi:bus', data: { kind: 'bus', pickupLocation: 'A', dropoffLocation: 'B' } })
    expect(bookings[1]).toMatchObject({ type: 'other', icon: 'mdi:ferry', data: { kind: 'ferry', startLocation: 'A', endLocation: 'B' } })
    expect(changes).toHaveLength(2)
    expect(changes[0]).toMatchObject({ from: 'train/—', to: 'car/bus' })
    expect(changes[1]).toMatchObject({ from: 'train/—', to: 'other/ferry' })
  })

  it('оставляет поезда поездами', () => {
    const { bookings, changes } = reclassifyBookings([
      train('1', 'Станция Banqiao ➔ Станция THSR Taichung', 'mdi:train-variant', { notes: '🚄 Сверхскоростной поезд THSR (300 км/ч)' }),
      // «Авто» в заголовке — не повод тащить поезд в раздел «Авто»
      train('2', 'Автовокзал ➔ Центр', 'mdi:train', { notes: 'Поезд TRA' }),
      train('3', 'Тайбэй ➔ Хуалянь', 'mdi:train'),
    ])

    expect(bookings.every(b => b.type === 'train')).toBe(true)
    expect(changes).toHaveLength(0)
  })

  it('проставляет пометку автомобильным записям', () => {
    const { bookings } = reclassifyBookings([
      car('1', 'Гаосюн ➔ Порт Дунган', 'mdi:bus', { notes: '🚖 Шаттл / такси к причалу' }),
      car('2', 'Хуалянь ➔ Скалы Циншуй', 'mdi:car', { company: 'Авто с водителем (customized)' }),
      car('3', 'Фэньциху ➔ Чайный Шичжоу', 'mdi:car', { company: 'Местное такси (5 км)' }),
      car('4', 'Аэропорт ➔ Отель', 'mdi:airport-shuttle', { company: 'Прямой трансфер' }),
    ])

    expect(bookings[0]).toMatchObject({ type: 'car', data: { kind: 'taxi' } })
    expect(bookings[1]).toMatchObject({ type: 'car', data: { kind: 'chauffeur' } })
    expect(bookings[2]).toMatchObject({ type: 'car', data: { kind: 'taxi' } })
    expect(bookings[3]).toMatchObject({ type: 'car', data: { kind: 'transfer' } })
  })

  it('выносит электробайк из «Авто» в «Другое»', () => {
    const { bookings, changes } = reclassifyBookings([
      car('1', 'Остров Сяолюцю ➔ передвижение', 'mdi:moped', {
        company: 'Электробайк (E-bike, без прав)',
        notes: '🛵 Прокат у пирса Байша',
      }),
    ])

    const migrated = bookings[0] as Booking & { type: 'other', data: OtherData }
    expect(migrated.type).toBe('other')
    expect(migrated.data.kind).toBe('bike')
    expect(migrated.data.name).toBe('Электробайк (E-bike, без прав)')
    expect(migrated.icon).toBe('mdi:bike')
    expect(changes).toHaveLength(1)
  })

  it('использует иконку, когда текста недостаточно, и не трогает прочие разделы', () => {
    const flight: Booking = { id: 'f', type: 'flight', icon: 'mdi:airplane', title: 'Москва - Тайбэй', data: { segments: [] } }
    const { bookings, changes } = reclassifyBookings([
      car('1', 'Гаосюн ➔ Порт Дунган', 'mdi:bus'),
      flight,
    ])

    expect(bookings[0]).toMatchObject({ type: 'car', icon: 'mdi:bus', data: { kind: 'bus' } })
    expect(bookings[1]).toBe(flight)
    expect(changes).toHaveLength(1)
  })
})
