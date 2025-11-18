import { DAY_IDS, TRIP_ID } from '../constants'

export const MOCK_DAY_12 = {
  id: DAY_IDS.DAY_12,
  tripId: TRIP_ID,
  date: new Date('2025-05-21'),
  title: 'Побег',
  description: 'День отъезда из Шанхая. После завтрака и сборов у нас будет немного свободного времени для последней прогулки перед отправлением в аэропорт Пудун для вылета в следующую точку нашего путешествия.',
  activities: [
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_12, startTime: '09:30', endTime: '11:00', title: 'Завтрак и выселение из отеля', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Собираем вещи, выселяемся из отеля. Можно попросить оставить багаж на ресепшене, если планируете еще погулять.' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_12, startTime: '11:00', endTime: '13:00', title: 'Прощальная прогулка', tag: 'walk' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Свободное время для покупки сувениров или прогулки.' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_12, startTime: '14:00', endTime: '17:05', title: 'Дорога в аэропорт и вылет', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Прибытие в Аэропорт Пудун (PVG) за 3 часа до вылета, регистрация на рейс и вылет.' }] },
  ],
}
