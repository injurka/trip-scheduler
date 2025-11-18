import { DAY_IDS, TRIP_ID } from '../constants'

export const MOCK_DAY_06 = {
  id: DAY_IDS.DAY_06,
  tripId: TRIP_ID,
  date: new Date('2025-05-15'),
  title: 'Искусство и Архитектура',
  description: 'Свободный день для отдыха, самостоятельного исследования или повторного посещения наиболее понравившихся мест. Отличная возможность отойти от плотного графика и насладиться городом в собственном темпе.',
  activities: [{ id: crypto.randomUUID(), dayId: DAY_IDS.DAY_06, startTime: '10:00', endTime: '22:00', title: 'Свободный день', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Этот день оставлен свободным для того, чтобы вы могли повторить то, что понравилось больше всего, или исследовать что-то новое по своему усмотрению.' }] }],
}
