import type { LinkCategory } from '../models/types'

export const linkCategories: LinkCategory[] = [
  {
    title: 'Авиабилеты',
    icon: 'mdi:airplane',
    links: [
      { name: 'Aviasales', url: 'https://www.aviasales.ru/', description: 'Популярный агрегатор для поиска дешевых авиабилетов.', recommended: true, tags: ['агрегатор', 'бюджетно'] },
      { name: 'Trip.com', url: 'https://www.trip.com/', description: 'Крупное онлайн-агентство для бронирования авиабилетов, отелей и другого.', recommended: true, tags: ['агрегатор', 'отели', 'комплексный поиск'] },
      { name: 'Skyscanner', url: 'https://www.skyscanner.ru/', description: 'Глобальный поисковик авиабилетов, отелей и проката автомобилей.', tags: ['агрегатор', 'комплексный поиск'] },
      { name: 'Kiwi.com', url: 'https://www.kiwi.com/', description: 'Находит уникальные маршруты, комбинируя рейсы разных авиакомпаний.', tags: ['сложные маршруты'] },
      { name: 'Google Flights', url: 'https://www.google.com/flights', description: 'Сервис от Google для поиска и сравнения авиабилетов.', tags: ['агрегатор', 'карта цен'] },
    ],
  },
  {
    title: 'Жилье',
    icon: 'mdi:hotel',
    links: [
      { name: 'Booking.com', url: 'https://www.booking.com/', description: 'Один из крупнейших сайтов для бронирования отелей и апартаментов.', recommended: true, tags: ['отели', 'апартаменты'] },
      { name: 'Ostrovok', url: 'https://ostrovok.ru/', description: 'Российский сервис онлайн-бронирования отелей.', tags: ['отели', 'Россия'] },
      { name: 'Airbnb', url: 'https://www.airbnb.com/', description: 'Аренда частного жилья: квартиры, дома и комнаты по всему миру.', tags: ['квартиры', 'долгосрочно'] },
      { name: 'Agoda', url: 'https://www.agoda.com/', description: 'Популярен для бронирования жилья в странах Азии.', tags: ['отели', 'Азия'] },
      { name: 'Hostelworld', url: 'https://www.hostelworld.com/', description: 'Крупнейший сервис для поиска и бронирования хостелов.', tags: ['хостелы', 'бюджетно'] },
    ],
  },
  {
    title: 'Наземный транспорт',
    icon: 'mdi:train-car',
    links: [
      { name: 'РЖД', url: 'https://www.rzd.ru/', description: 'Официальный сайт для покупки билетов на поезда по России.', tags: ['поезда', 'Россия'] },
      { name: 'Tutu.ru', url: 'https://www.tutu.ru/', description: 'Покупка билетов на поезда, автобусы и электрички.', tags: ['поезда', 'автобусы', 'Россия'] },
      { name: 'Omio', url: 'https://www.omio.com/', description: 'Агрегатор билетов на поезда, автобусы и самолеты по Европе.', tags: ['поезда', 'автобусы', 'Европа'] },
      { name: 'Rentalcars', url: 'https://www.rentalcars.com/', description: 'Сервис для поиска и аренды автомобилей по всему миру.', recommended: true, tags: ['аренда авто'] },
      { name: 'BlaBlaCar', url: 'https://www.blablacar.ru/', description: 'Поиск попутчиков для междугородних поездок.', tags: ['бюджетно', 'попутчики'] },
      { name: 'FlixBus', url: 'https://www.flixbus.com/', description: 'Крупнейший оператор автобусных перевозок в Европе.', tags: ['автобусы', 'Европа', 'бюджетно'] },
    ],
  },
  {
    title: 'Туры и активности',
    icon: 'mdi:map-marker-path',
    links: [
      { name: 'GetYourGuide', url: 'https://www.getyourguide.com/', description: 'Бронирование экскурсий, мероприятий и билетов в достопримечательности.', recommended: true, tags: ['экскурсии', 'билеты'] },
      { name: 'Viator', url: 'https://www.viator.com/', description: 'Дочерняя компания TripAdvisor для поиска и бронирования туров.', tags: ['экскурсии', 'туры'] },
      { name: 'Sputnik8', url: 'https://www.sputnik8.com/', description: 'Экскурсии от местных жителей в разных городах мира.', tags: ['экскурсии', 'авторские туры'] },
      { name: 'Klook', url: 'https://www.klook.com/', description: 'Платформа для бронирования активностей, туров и билетов, особенно популярна в Азии.', tags: ['Азия', 'билеты', 'активности'] },
    ],
  },
  {
    title: 'Страхование',
    icon: 'mdi:shield-check-outline',
    links: [
      { name: 'Cherehapa', url: 'https://cherehapa.ru/', description: 'Агрегатор туристических страховок от ведущих компаний.', recommended: true, tags: ['агрегатор', 'сравнение'] },
      { name: 'SafetyWing', url: 'https://safetywing.com/', description: 'Страхование для путешественников и цифровых кочевников.', tags: ['долгосрочно', 'кочевники'] },
      { name: 'Сравни.ру', url: 'https://www.sravni.ru/vse-strakhovye-kompanii/', description: 'Сравнение и покупка страховых полисов онлайн.', tags: ['агрегатор', 'сравнение'] },
    ],
  },
  {
    title: 'Карты и навигация',
    icon: 'mdi:map-outline',
    links: [
      { name: 'Google Maps', url: 'https://maps.google.com/', description: 'Глобальный картографический сервис с построением маршрутов.', recommended: true, tags: ['онлайн', 'маршруты'] },
      { name: 'Maps.me', url: 'https://maps.me/', description: 'Офлайн-карты с детальной навигацией по всему миру.', tags: ['офлайн', 'без интернета'] },
      { name: 'Organic Maps', url: 'https://organicmaps.app/', description: 'Бесплатные офлайн-карты для путешественников без рекламы и трекеров.', tags: ['офлайн', 'эко-туризм'] },
      { name: '2GIS', url: 'https://2gis.ru/', description: 'Детальные карты городов с информацией об организациях и транспорте.', tags: ['города', 'Россия', 'СНГ'] },
    ],
  },
  {
    title: 'Связь в поездке',
    icon: 'mdi:sim-outline',
    links: [
      { name: 'Airalo', url: 'https://www.airalo.com/', description: 'Сервис для покупки виртуальных SIM-карт (eSIM) для интернета за границей.', recommended: true, tags: ['eSIM', 'интернет'] },
      { name: 'Drimsim', url: 'https://drimsim.com/', description: 'Универсальная SIM-карта для путешественников.', tags: ['SIM-карта', 'интернет'] },
    ],
  },
  {
    title: 'Финансы',
    icon: 'mdi:currency-usd',
    links: [
      { name: 'XE Currency', url: 'https://www.xe.com/', description: 'Актуальные курсы валют и конвертер.', tags: ['валюта', 'конвертер'] },
      { name: 'Numbeo', url: 'https://www.numbeo.com/cost-of-living/', description: 'Сравнение стоимости жизни в разных городах мира.', tags: ['цены', 'бюджет'] },
    ],
  },
  {
    title: 'Полезная информация',
    icon: 'mdi:information-outline',
    links: [
      { name: 'TripAdvisor', url: 'https://www.tripadvisor.com/', description: 'Отзывы и советы путешественников об отелях, ресторанах и развлечениях.', tags: ['отзывы', 'советы'] },
      { name: 'Nomad List', url: 'https://nomadlist.com/', description: 'Информация для цифровых кочевников о городах мира.', tags: ['кочевники', 'удаленка'] },
      { name: 'Форум Винского', url: 'https://forum.awd.ru/', description: 'Крупнейший русскоязычный форум самостоятельных путешественников.', tags: ['форум', 'советы'] },
      { name: 'Skift', url: 'https://skift.com/', description: 'Новости и аналитика из мира туризма (на английском).', tags: ['новости', 'аналитика'] },
    ],
  },
]
