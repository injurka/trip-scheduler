import { v4 as uuidv4 } from 'uuid'
import { MOCK_USER_ID_1 } from './00.users'

export const MOCK_DESTINATION_REVIEWS_DATA = [
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    type: 'city',
    countryId: '4edb4270-8701-4f49-b6fc-684da36c83eb', // Италия
    city: 'Рим',
    coverUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1200&auto=format&fit=crop',
    latitude: 41.9028,
    longitude: 12.4964,
    content: 'Античный город, который захватывает дух. Обязательно попробуйте настоящую пасту и джелато вдали от туристических троп.',
    metrics: { Еда: 5, Архитектура: 5, Атмосфера: 5, Транспорт: 3 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    type: 'country',
    countryId: 'e30c61ad-ea40-423a-a8a2-4f39ac5a89d8', // Япония
    city: null,
    coverUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
    latitude: 36.2048,
    longitude: 138.2529,
    content: 'Страна невероятных контрастов: от неоновых огней Токио до тихих, умиротворяющих храмов Киото. Удивительная культура уважения и невероятно вкусная еда.',
    metrics: { Культура: 5, Еда: 5, Безопасность: 5, Природа: 4, Цены: 3 },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    type: 'city',
    countryId: 'fe6ce9a6-d827-4b23-9920-f0cfbd335a61', // Франция
    city: 'Париж',
    coverUrl: 'https://images.unsplash.com/photo-1502602898657-3e907600bb8e?q=80&w=1200&auto=format&fit=crop',
    latitude: 48.8566,
    longitude: 2.3522,
    content: 'Париж прекрасен в любое время года. Да, здесь много туристов, но если гулять рано утром, атмосфера просто неповторимая.',
    metrics: { Романтика: 5, Архитектура: 5, Музеи: 4, Цены: 2 },
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
]
