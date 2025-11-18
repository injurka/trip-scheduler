import { getRoutePath, TRIP_ID, USER_ID } from './constants'
import { MOCK_DAYS } from './days'
import { MOCK_IMAGES } from './images'
import { MOCK_SECTIONS } from './sections'

const MOCK_TRIP_ZHANGJIAJIE = {
  id: TRIP_ID,
  title: 'Горы Аватара и 8D-магия Чунцина',
  userId: USER_ID,
  imageUrl: getRoutePath('20250824231936.png'),
  description: 'Незабываемое путешествие по Китаю: от культурных сокровищ Чанши до неземных пейзажей Чжанцзяцзе, вдохновивших "Аватар". Погружение в сказочную атмосферу древнего города Фэнхуан и исследование футуристической 8D-реальности Чунцина.',
  startDate: new Date('2025-10-19'),
  endDate: new Date('2025-11-03'),
  cities: ['Чанша', 'Чжанцзяцзе', 'Фэнхуан', 'Чунцин'],
  status: 'planned' as const,
  budget: 250_000,
  currency: 'RUB',
  tags: ['Китай', 'Чжанцзяцзе', 'Чунцин', 'Горы Аватара', 'природа', 'хайкинг', 'мегаполис', 'культура', 'история'],
  visibility: 'public' as const,

  images: MOCK_IMAGES,
  sections: MOCK_SECTIONS,
  days: MOCK_DAYS,
  memories: [],
}

export { MOCK_TRIP_ZHANGJIAJIE }
