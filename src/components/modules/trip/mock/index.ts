import type { Activity } from '../models/activity'

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: '1',
    day: 1,
    startTime: '09:00',
    endTime: '10:30',
    description: 'Поездка в аэропорт',
    blocks: [{
      id: '1',
      description: 'Значимость этих проблем настолько очевидна, что консультация с широким активом способствует подготовки и реализации направлений прогрессивного развития. С другой стороны дальнейшее развитие различных форм деятельности обеспечивает широкому кругу (специалистов) участие в формировании модели развития.',
    }],
  },
  {
    id: '2',
    day: 1,
    startTime: '11:00',
    endTime: '13:00',
    description: 'Посещение Колизея',
    blocks: [],
  },
  {
    id: '3',
    day: 1,
    startTime: '13:30',
    endTime: '14:30',
    description: 'Обед в Trattoria',
    blocks: [],
  },
  {
    id: '4',
    day: 2,
    startTime: '10:00',
    endTime: '12:00',
    description: 'Прогулка по парку',
    blocks: [],
  },
  {
    id: '5',
    day: 2,
    startTime: '14:00',
    endTime: '16:00',
    description: 'Отдых в спа',
    blocks: [],
  },

]

export { MOCK_ACTIVITIES }
