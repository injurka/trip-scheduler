import { v4 as uuidv4 } from 'uuid'
import { MOCK_USER_ID_1 } from './00.users'

const baseImageUrl1 = 'https://images.unsplash.com/photo-1498307833015-e7b400441eb8'
const baseImageUrl2 = 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a'
const baseImageUrl3 = 'https://images.unsplash.com/photo-1542051812-ba32e00f6b70'
const baseImageUrl4 = 'https://images.unsplash.com/photo-1539037116271-8b52eb40898a' // Испания
const baseImageUrl5 = 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9' // США
const baseImageUrl6 = 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a' // Таиланд
const baseImageUrl7 = 'https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3' // Турция
const baseImageUrl8 = 'https://images.unsplash.com/photo-1513326738677-b964603b136d' // Россия

export const MOCK_HIGHLIGHTS_DATA = [
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl1}?q=80&w=1200&auto=format&fit=crop`,
    countryId: '4edb4270-8701-4f49-b6fc-684da36c83eb', // Италия
    city: 'Рим',
    address: 'Колизей',
    comment: 'Невероятная архитектура и дух времени!',
    latitude: 41.8902,
    longitude: 12.4922,
    createdAt: new Date(),
    takenAt: new Date('2025-08-15T14:30:00Z'),
    width: 1200,
    height: 800,
    variants: {
      small: `${baseImageUrl1}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl1}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Canon', model: 'EOS 5D Mark IV' },
      settings: { iso: 100, aperture: 2.8, shutterSpeed: '1/1000s' },
    },
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl2}?q=80&w=1200&auto=format&fit=crop`,
    countryId: 'fe6ce9a6-d827-4b23-9920-f0cfbd335a61', // Франция
    city: 'Париж',
    address: 'Эйфелева башня',
    comment: 'Романтика на каждом шагу.',
    latitude: 48.8584,
    longitude: 2.2945,
    createdAt: new Date(Date.now() - 86400000),
    takenAt: new Date('2025-07-20T19:00:00Z'),
    width: 1200,
    height: 1500,
    variants: {
      small: `${baseImageUrl2}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl2}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Sony', model: 'Alpha 7 III' },
      settings: { iso: 400, aperture: 4.0, shutterSpeed: '1/250s' },
    },
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl3}?q=80&w=1200&auto=format&fit=crop`,
    countryId: 'e30c61ad-ea40-423a-a8a2-4f39ac5a89d8', // Япония
    city: 'Токио',
    address: 'Храм Сэнсо-дзи',
    comment: 'Смешение современности и традиций.',
    latitude: 35.7147,
    longitude: 139.7966,
    createdAt: new Date(Date.now() - 86400000 * 2),
    takenAt: new Date('2024-11-10T09:15:00Z'),
    width: 1200,
    height: 801,
    variants: {
      small: `${baseImageUrl3}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl3}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Nikon', model: 'Z 6II' },
      settings: { iso: 200, aperture: 5.6, shutterSpeed: '1/500s' },
    },
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl4}?q=80&w=1200&auto=format&fit=crop`,
    countryId: 'e9be1cb9-0864-4adf-abba-9d119013b053', // Испания
    city: 'Барселона',
    address: 'Саграда Фамилия',
    comment: 'Шедевр Гауди, который строят уже более 100 лет. Витражи внутри просто космос!',
    latitude: 41.4036,
    longitude: 2.1744,
    createdAt: new Date(Date.now() - 86400000 * 3),
    takenAt: new Date('2025-09-05T11:00:00Z'),
    width: 1200,
    height: 1600,
    variants: {
      small: `${baseImageUrl4}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl4}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Fujifilm', model: 'X-T4' },
      settings: { iso: 160, aperture: 8.0, shutterSpeed: '1/125s' },
    },
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl5}?q=80&w=1200&auto=format&fit=crop`,
    countryId: 'c7f89013-2e19-4501-bdef-94167dc0d760', // США
    city: 'Нью-Йорк',
    address: 'Таймс-сквер',
    comment: 'Ослепительные неоновые вывески и энергия города, который никогда не спит.',
    latitude: 40.7580,
    longitude: -73.9855,
    createdAt: new Date(Date.now() - 86400000 * 5),
    takenAt: new Date('2024-12-31T23:45:00Z'),
    width: 1200,
    height: 800,
    variants: {
      small: `${baseImageUrl5}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl5}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Sony', model: 'Alpha 7R IV' },
      settings: { iso: 800, aperture: 2.8, shutterSpeed: '1/60s' },
    },
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl6}?q=80&w=1200&auto=format&fit=crop`,
    countryId: '54d5ef6b-2625-43ad-94ef-cec5525cd83e', // Таиланд
    city: 'Бангкок',
    address: 'Большой дворец',
    comment: 'Золотые ступы переливаются на солнце. Очень жарко, но потрясающе красиво.',
    latitude: 13.7500,
    longitude: 100.4913,
    createdAt: new Date(Date.now() - 86400000 * 10),
    takenAt: new Date('2025-02-15T10:20:00Z'),
    width: 1200,
    height: 900,
    variants: {
      small: `${baseImageUrl6}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl6}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Canon', model: 'EOS R5' },
      settings: { iso: 100, aperture: 5.6, shutterSpeed: '1/800s' },
    },
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl7}?q=80&w=1200&auto=format&fit=crop`,
    countryId: 'fa7aa91a-d451-4745-9a62-e4f245b842a6', // Турция
    city: 'Стамбул',
    address: 'Айя-София',
    comment: 'Место встречи двух континентов и нескольких эпох. Монументально!',
    latitude: 41.0082,
    longitude: 28.9784,
    createdAt: new Date(Date.now() - 86400000 * 12),
    takenAt: new Date('2025-04-10T16:45:00Z'),
    width: 1200,
    height: 1200,
    variants: {
      small: `${baseImageUrl7}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl7}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Apple', model: 'iPhone 14 Pro Max' },
      settings: { iso: 50, aperture: 1.8, shutterSpeed: '1/1500s' },
    },
  },
  {
    id: uuidv4(),
    userId: MOCK_USER_ID_1,
    imageUrl: `${baseImageUrl8}?q=80&w=1200&auto=format&fit=crop`,
    countryId: 'd0d7e94b-c8a7-40ed-a63f-d26bfca8606d', // Россия
    city: 'Москва',
    address: 'Красная площадь',
    comment: 'Зимой здесь особенная атмосфера. ГУМ в огнях и снег вокруг.',
    latitude: 55.7539,
    longitude: 37.6208,
    createdAt: new Date(Date.now() - 86400000 * 15),
    takenAt: new Date('2025-01-05T19:30:00Z'),
    width: 1200,
    height: 800,
    variants: {
      small: `${baseImageUrl8}?q=75&w=400&auto=format&fit=crop`,
      medium: `${baseImageUrl8}?q=80&w=800&auto=format&fit=crop`,
    },
    metadata: {
      camera: { make: 'Nikon', model: 'D850' },
      settings: { iso: 1600, aperture: 4.0, shutterSpeed: '1/100s' },
    },
  },
]
