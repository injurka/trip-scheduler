import { DAY_IDS, getRoutePath, TRIP_ID } from '../constants'

export const MOCK_DAY_01 = {
  id: DAY_IDS.DAY_01,
  tripId: TRIP_ID,
  date: new Date('2025-05-10'),
  title: 'Начало пути',
  description: 'Наше китайское приключение начинается с прибытия в аэропорт Хунцяо. Вечерняя программа идеально подходит для первого знакомства с городом без лишней нагрузки: спокойная прогулка по современному парку и ужин у архитектурного шедевра "Тысяча Деревьев".',
  activities: [
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_01, startTime: '16:00', endTime: '17:00', title: 'Прибытие в Аэропорт Хунцяо (SHA)', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Прибытие и трансфер в отель.' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_01, startTime: '17:00', endTime: '18:15', title: 'Заселение в отель Yunhe Yebo Hotel', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Заселение, короткий отдых после перелета.\nАдрес: `2-5F, Area C, 1F, No.503 Wuning Road, Путуо, Шанхай`' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_01, startTime: '18:15', endTime: '18:30', title: 'Путь к метро Caoyang Road', tag: 'walk' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Прогулка до станции метро **Caoyang Road (曹杨路)** или **Fengqiao Rd. (枫桥路)**. \n\n*Совет*: Приобретите транспортную карту Shanghai Transportation Card для удобства передвижения по городу (доступна в AliPay).' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250216013656.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_01, startTime: '18:30', endTime: '19:30', title: 'Прогулка по парку Suzhouhe Mengqing Garden', tag: 'walk' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: '**Environmental Theme Park of Suzhouhe Mengqing Garden(苏州河梦清园环保主题公园)**\n\nЖивописный парк вдоль реки Сучжоу — идеальное место для акклиматизации. \n*Что посмотреть*: Красивый ландшафтный дизайн, пешеходные мостики, местные растения, виды на реку.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250216013458.png'), getRoutePath('20250221130326.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_01, startTime: '19:30', endTime: '22:00', title: 'Ужин в Tian\'an Thousand Trees', tag: 'food' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Посещение уникального архитектурного комплекса **Ocean Jewel · Tian\'an Thousand Trees (大洋晶典·天安千树)**, напоминающего "вертикальный лес". \n\n**Рекомендуемые заведения:**\n* *Element Fresh* — европейская кухня с легкими блюдами\n* *Haidilao (海底捞)* — знаменитый китайский хотпот (требуется бронирование)\n* *Costa Coffee* — для любителей кофе и легких закусок' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250216013213.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_01, startTime: '22:00', endTime: '22:30', title: 'Возвращение в отель', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Поездка на метро обратно в отель для отдыха. \n\n**Важно:** Последние поезда метро отправляются примерно в 22:30-23:00!' }] },
  ],
}
