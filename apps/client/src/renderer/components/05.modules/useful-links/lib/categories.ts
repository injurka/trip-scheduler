import type { CategoryInfo } from '../models/types'

export const LINK_CATEGORIES: CategoryInfo[] = [
  {
    id: 'maps',
    title: 'Карты и навигация',
    icon: 'mdi:map-outline',
    description: 'Навигаторы, офлайн-карты, схемы метро и маршруты',
  },
  {
    id: 'payment',
    title: 'Оплата и финансы',
    icon: 'mdi:credit-card-outline',
    description: 'Транспортные карты, электронные кошельки, QR-оплата и валюта',
  },
  {
    id: 'transport',
    title: 'Транспорт и такси',
    icon: 'mdi:train-car',
    description: 'Поезда, такси, аренда авто, паромы и автобусы',
  },
  {
    id: 'hotels',
    title: 'Жилье и отели',
    icon: 'mdi:hotel',
    description: 'Отели, хостелы, апартаменты и курорты',
  },
  {
    id: 'flights',
    title: 'Авиабилеты',
    icon: 'mdi:airplane',
    description: 'Агрегаторы рейсов, поиск дешевых билетов и лоукостеры',
  },
  {
    id: 'activities',
    title: 'Туры и билеты',
    icon: 'mdi:ticket-outline',
    description: 'Экскурсии, билеты в парки и достопримечательности',
  },
  {
    id: 'connectivity',
    title: 'Связь и интернет',
    icon: 'mdi:sim-outline',
    description: 'eSIM, SIM-карты, интернет в роуминге',
  },
  {
    id: 'food',
    title: 'Еда и рестораны',
    icon: 'mdi:silverware-fork-knife',
    description: 'Поиск ресторанов, отзывы местных, меню и бронирование',
  },
  {
    id: 'info',
    title: 'Полезное и страховка',
    icon: 'mdi:information-outline',
    description: 'Страхование, форумы, визовые правила и советы',
  },
]
