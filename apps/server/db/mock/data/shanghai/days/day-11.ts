import { DAY_IDS, getRoutePath, TRIP_ID } from '../constants'

export const MOCK_DAY_11 = {
  id: DAY_IDS.DAY_11,
  tripId: TRIP_ID,
  date: new Date('2025-05-20'),
  title: 'Небесный Рай (Hangzhou)',
  description: 'Однодневная поездка в Ханчжоу, который Марко Поло называл "самым прекрасным городом в мире". Мы совершим прогулку по живописному озеру Сиху, посетим знаменитый буддийский храм Линъинь и продегустируем один из лучших чаев Китая, Лунцзин, прямо на плантациях.',
  activities: [
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_11, startTime: '09:00', endTime: '11:00', title: 'Дорога до вокзала и поездка в Ханчжоу', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Поездка на метро до вокзала **Hongqiao (虹桥火车站)** и путешествие на скоростном поезде (G-серия).' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250314010452.png'), getRoutePath('20250314010555.png'), getRoutePath('20250314010608.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_11, startTime: '11:30', endTime: '14:00', title: 'Прогулка по озеру Сиху (West Lake)', tag: 'walk' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Осмотр озера **(西湖)**, включенного в список Всемирного наследия ЮНЕСКО, и прогулка по дамбе **Су (苏堤)**.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250314011414.png'), getRoutePath('20250314011512.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_11, startTime: '14:30', endTime: '15:30', title: 'Посещение храма Линъинь (Lingyin Temple)', tag: 'attraction' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Визит в один из самых знаменитых буддийских храмов Китая **(灵隐寺)**, известный своими статуями, вырезанными в скалах. Вход: 45 CNY.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250314011957.png'), getRoutePath('20250314011847.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_11, startTime: '16:30', endTime: '19:50', title: 'Посещение чайной деревни и ужин', tag: 'food' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: '**Вариант 1: Деревня Мэйцзяу (Meijiawu Tea Village 梅家坞)**\nБолее аутентичная атмосфера, панорамные виды на плантации. Ужин в фермерском ресторане (*农家乐*).\n\n**Вариант 2: Деревня Лунцзин (Longjing Tea Village 龙井村)**\nПрогулка по знаменитым плантациям, дегустация чая "Колодец Дракона" и ужин в ресторане, где готовят блюда с чаем.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('Meijiawu Tea Plantation Path.png'), getRoutePath('Meijiawu Tea Plantation 1.jpg'), getRoutePath('Meijiawu Tea Plantation 2.jpg'), getRoutePath('20250314012046.png'), getRoutePath('20250314012322.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_11, startTime: '21:21', endTime: '22:22', title: 'Возвращение в Шанхай', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Поездка на скоростном поезде обратно в Шанхай.' }] },
  ],
}
