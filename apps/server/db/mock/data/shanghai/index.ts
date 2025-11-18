import { getRoutePath, TRIP_ID, USER_ID_1, USER_ID_2 } from './constants'
import { MOCK_DAYS } from './days'
import { MOCK_IMAGES } from './images'
import { MOCK_SECTIONS } from './sections'

const MOCK_TRIP_SHANGHAI = {
  id: TRIP_ID,
  title: 'От Шанхая до Шелкового пути',
  userId: USER_ID_1,
  imageUrl: getRoutePath('20250217214032.png'),
  description: 'Двухнедельное приключение, охватывающее футуристический Шанхай, классические сады Сучжоу и Ханчжоу, и заканчивающееся в сердце древнего Шелкового пути — Урумчи.',
  startDate: new Date('2025-05-10'),
  endDate: new Date('2025-05-23'),
  cities: ['Шанхай', 'Сучжоу', 'Ханчжоу', 'Урумчи'],
  status: 'completed' as const,
  budget: 150_000,
  currency: 'RUB',
  tags: ['Китай', 'Шанхай', 'Урумчи', 'культура', 'еда', 'приключения'],
  visibility: 'public' as const,
  participantIds: [USER_ID_1, USER_ID_2],

  images: MOCK_IMAGES,
  sections: MOCK_SECTIONS,
  days: MOCK_DAYS,
  memories: [],
}

export { MOCK_TRIP_SHANGHAI }
