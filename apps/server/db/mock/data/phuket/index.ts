import { getRoutePath, TRIP_ID, USER_ID } from './constants'
import { MOCK_DAYS } from './days'
import { MOCK_IMAGES } from './images'
import { MOCK_SECTIONS } from './sections'

export const MOCK_TRIP_PHUKET = {
  id: TRIP_ID,
  title: 'Сокровища Пхукета: от пляжей до Большого Будды',
  userId: USER_ID,
  imageUrl: getRoutePath('phuket-promthep-cape.jpg'),
  description: 'Пятидневное исследование жемчужины Таиланда — Пхукета. Маршрут включает отдых на знаменитых пляжах Ката и Най Харн, посещение духовных центров острова, таких как Большой Будда, и погружение в колоритную атмосферу Старого города.',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-05'),
  cities: ['Пхукет'],
  status: 'draft' as const,
  budget: 80000,
  currency: 'RUB',
  tags: ['Таиланд', 'Пхукет', 'пляж', 'море', 'природа', 'хайкинг', 'культура'],
  visibility: 'private' as const,
  participantIds: [USER_ID],

  // --- Собираем все импортированные части вместе ---
  images: MOCK_IMAGES,
  sections: MOCK_SECTIONS,
  days: MOCK_DAYS,
  memories: [],
}
