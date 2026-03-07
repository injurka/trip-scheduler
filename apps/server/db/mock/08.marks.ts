import { v4 as uuidv4 } from 'uuid'
import { MOCK_USER_ID_1 } from './00.users'

// Генерируем динамические даты, чтобы при каждом сидировании они были актуальными
const now = Date.now()
const oneHour = 60 * 60 * 1000

export const MOCK_MARKS_DATA = [
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    title: 'Парк Горького',
    description: 'Отличное место для прогулок и отдыха. Работает круглосуточно.',
    latitude: 55.7315,
    longitude: 37.6035,
    categoryId: 2,
    duration: 0, // 0 = статичная метка (Место)
    startAt: new Date(now).toISOString(),
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    title: 'Обед в ресторане',
    description: 'Забронирован столик с видом на реку.',
    latitude: 55.7445,
    longitude: 37.6055,
    categoryId: 1,
    duration: 2, // Длительность 2 часа
    startAt: new Date(now - oneHour).toISOString(), // Началось час назад (Идёт сейчас)
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    title: 'Экскурсия в музей',
    description: 'Встреча у главного входа с гидом.',
    latitude: 55.7414,
    longitude: 37.6208,
    categoryId: 1,
    duration: 3, // Длительность 3 часа
    startAt: new Date(now + oneHour * 24).toISOString(), // Начнется завтра (Ожидается)
  },
]
