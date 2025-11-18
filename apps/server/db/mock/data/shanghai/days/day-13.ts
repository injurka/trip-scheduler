import { DAY_IDS, getRoutePath, TRIP_ID } from '../constants'

export const MOCK_DAY_13 = {
  id: DAY_IDS.DAY_13,
  tripId: TRIP_ID,
  date: new Date('2025-05-22'),
  title: 'На распутье (Урумчи)',
  description: 'После ночного прилета в Урумчи и короткого отдыха, мы отправимся в однодневную поездку к жемчужине Тянь-Шанских гор — Небесному озеру (Тяньчи). Нас ждут потрясающие виды высокогорного озера в окружении заснеженных пиков.',
  activities: [
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_13, startTime: '00:20', endTime: '01:30', title: 'Прилет в Урумчи и заселение в отель', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Ночное прибытие, трансфер на такси и заселение в **Atour Hotel (乌鲁木齐北京南路中营工地铁站亚朵酒店)**. [Отель на карте](https://j.map.baidu.com/10/dMWg)' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250506095740.png'), getRoutePath('0206a12000990mnse338F_W_1280_853_R5.webp'), getRoutePath('0206112000990n39g16CC_W_1280_853_R5.webp')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_13, startTime: '09:30', endTime: '12:30', title: 'Поездка до Национального парка Тяньшань Тяньчи', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Дорога до **Международного автовокзала Урумчи Гаоте (乌鲁木齐高铁国际汽车客运站)**. \n\nТам нужно купить билет на туристический автобус до **Тяньчи (天山天池)**. Поездка на автобусе займет около 1.5 часов.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250506100018.png'), getRoutePath('202505031601413.png'), getRoutePath('unnamed.jpg')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_13, startTime: '12:30', endTime: '17:00', title: 'Исследование Небесного озера (Тяньчи)', tag: 'attraction' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Поездка на шаттле до озера. \n\n**Возможные активности:**\n*   Прогулка по дорожкам\n*   Поездка на лодке (за доп. плату)\n*   Посещение даосского храма на берегу\n*   Обед в кафе на территории.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('tianchi2.jpg'), getRoutePath('depositphotos_139790534-stock-photo-xinjiang-china-may-09-2015.webp')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_13, startTime: '17:00', endTime: '19:00', title: 'Возвращение в Урумчи', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Поездка на автобусе обратно в город. \n\n**Важно:** Уточните время отправления последнего автобуса при покупке билета! Обычно последние рейсы около 17:30-18:30.' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_13, startTime: '19:00', endTime: '21:30', title: 'Вечерняя прогулка и ужин', tag: 'food' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Прогулка по парку **Liyu Mountain Park (鲤鱼山公园)** напротив отеля и ужин в одном из местных ресторанов.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('B62a46a9b9ffe8860d.jpeg')] }] },
  ],
}
