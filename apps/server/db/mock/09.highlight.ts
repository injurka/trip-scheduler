import { v4 as uuidv4 } from 'uuid'
import { MOCK_USER_ID_1 } from './00.users'

export const MOCK_HIGHLIGHTS_DATA = [
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: 'https://images.unsplash.com/photo-1498307833015-e7b400441eb8?q=80&w=1200&auto=format&fit=crop',
    countryId: '4edb4270-8701-4f49-b6fc-684da36c83eb', // Италия
    city: 'Рим',
    address: 'Колизей',
    comment: 'Невероятная архитектура и дух времени!',
    latitude: 41.8902,
    longitude: 12.4922,
    createdAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=1200&auto=format&fit=crop',
    countryId: 'fe6ce9a6-d827-4b23-9920-f0cfbd335a61', // Франция
    city: 'Париж',
    address: 'Эйфелева башня',
    comment: 'Романтика на каждом шагу.',
    latitude: 48.8584,
    longitude: 2.2945,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: 'https://images.unsplash.com/photo-1542051812-ba32e00f6b70?q=80&w=1200&auto=format&fit=crop',
    countryId: 'e30c61ad-ea40-423a-a8a2-4f39ac5a89d8', // Япония
    city: 'Токио',
    address: 'Храм Сэнсо-дзи',
    comment: 'Смешение современности и традиций.',
    latitude: 35.7147,
    longitude: 139.7966,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // Позавчера
  },
]
