import { DAY_IDS, getRoutePath, TRIP_ID } from '../constants'

export const MOCK_DAY_14 = {
  id: DAY_IDS.DAY_14,
  tripId: TRIP_ID,
  date: new Date('2025-05-23'),
  title: 'По базарам (Урумчи)',
  description: 'Последний день нашего путешествия. Мы познакомимся с Урумчи: поднимемся на Красную гору для панорамного вида на город, прогуляемся по паркам и окунемся в атмосферу знаменитого Международного Большого Базара.',
  activities: [
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_14, startTime: '09:00', endTime: '10:00', title: 'Завтрак и выселение', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Позавтракать, собрать вещи и оставить их на хранение в отеле. \n\n*Фраза для ресепшена:* "Можно оставить багаж?" (可以寄存行李吗? - Kěyǐ jìcún xínglǐ ma?).' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_14, startTime: '10:30', endTime: '11:30', title: 'Парк "Красная гора" (Hongshan Park)', tag: 'attraction' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Осмотр парка **(红山公园)** и подъем на пагоду для панорамного вида на город.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250226210917.png'), getRoutePath('20250226211046.png'), getRoutePath('20250226211112.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_14, startTime: '11:30', endTime: '12:30', title: 'Народный парк (People\'s Park)', tag: 'walk' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Прогулка по зеленому оазису в центре города **(乌鲁木齐人民公园)**.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250226211533.png'), getRoutePath('20250226211619.png'), getRoutePath('20250226212040.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_14, startTime: '12:30', endTime: '15:30', title: 'Обед и Большой Международный Базар', tag: 'food' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Обед по пути и исследование знаменитого **International Grand Bazaar (国际大巴扎)**. \n\nДо базара можно доехать на метро (станция **Erdaoqiao / 二道桥**). Осмотр архитектуры, мечети и сувенирных лавок.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250226212249.png'), getRoutePath('20250226213252.png'), getRoutePath('20250226214429.png'), getRoutePath('20250226214848.png'), getRoutePath('20250226214829.png'), getRoutePath('20250226215018.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_14, startTime: '15:30', endTime: '20:00', title: 'Возвращение за багажом и вылет', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: '**План действий:**\n1.  На метро от Базара доехать до станции отеля (**Zhongyinggong / 中营工**).\n2.  Забрать багаж из отеля.\n3.  Заказать такси до аэропорта (URC) и вылететь домой.' }] },
  ],
}
