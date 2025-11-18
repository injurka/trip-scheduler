import { DAY_IDS, TRIP_ID } from '../constants'

export const MOCK_DAY_10 = {
  id: DAY_IDS.DAY_10,
  tripId: TRIP_ID,
  date: new Date('2025-05-19'),
  title: 'Приход в чувства',
  description: 'Свободный день для восстановления сил после насыщенной недели. Можно выспаться, неспешно прогуляться по городу, вернуться в любимые места или открыть для себя что-то совершенно новое, не придерживаясь плана.',
  activities: [{ id: crypto.randomUUID(), dayId: DAY_IDS.DAY_10, startTime: '10:00', endTime: '22:00', title: 'Свободный день', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Этот день оставлен свободным для того, чтобы вы могли отдохнуть, восстановиться и подготовиться к следующему этапу путешествия.' }] }],
}
