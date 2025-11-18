import { DAY_IDS, getRoutePath, TRIP_ID } from '../constants'

export const MOCK_DAY_05 = {
  id: DAY_IDS.DAY_05,
  tripId: TRIP_ID,
  date: new Date('2025-05-14'),
  title: 'Древний город (Zhujiajiao Water Town)',
  description: 'Однодневная поездка в Чжуцзяцзяо, "шанхайскую Венецию". Мы будем гулять по старинным улочкам, пересекать каменные мосты, обедать с видом на каналы и наслаждаться аутентичной чайной церемонией.',
  activities: [
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_05, startTime: '09:30', endTime: '11:30', title: 'Дорога в Zhujiajiao', tag: 'transport' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Поездка на метро (17 линия) до древнего города на воде **(朱家角)**.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250309174651.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_05, startTime: '11:30', endTime: '13:00', title: 'Исследование North Street и моста Fangsheng', tag: 'walk' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Прогулка по главной улице **(北大街)** с магазинами и чайными домиками, подъем на самый известный мост **Fangsheng Bridge (放生桥)** для панорамных видов.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250309181742.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_05, startTime: '13:00', endTime: '15:00', title: 'Прогулка по турзоне и обед', tag: 'food' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Обед в одном из ресторанов с видом на воду в **Shanghai Zhujiajiao Ancient Town Tourist Zone (上海朱家角古镇旅游区)**.' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250309175314.png'), getRoutePath('20250309181154.png'), getRoutePath('20250309182313.png'), getRoutePath('20250309175856.png'), getRoutePath('20250309180345.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_05, startTime: '15:00', endTime: '16:30', title: 'Прогулка по секретным переулкам или посещение храма', tag: 'walk' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: '**Вариант 1 (Переулки):** Откройте для себя **Yujia Lane (郁家弄)** с резными ручками XVIII века и мастерской гончара Mr. Chen.\n\n**Вариант 2 (Храм):** Посетите маленький действующий **Храм городского божества (城隍庙)** недалеко от моста Fangsheng.' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_05, startTime: '16:30', endTime: '18:00', title: 'Чайная церемония в Zhuxi Teahouse', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Посещение аутентичного чайного дома **Zhuxi Teahouse (竹溪茶楼)** (Адрес: 92 Xihe Street). \nЗакажите набор «Четыре сезона» (80 RMB) и попробуйте закуску «лунный кролик».' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_05, startTime: '18:00', endTime: '19:30', title: 'Ужин и дегустация рисового вина', tag: 'food' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Ужин в ресторане **Shui Mian Lou (睡面楼)** со столиками над водой. \n\nПосле этого — дегустация местного рисового вина в лавке **Qian Niang Jiu Fang (前酿酒坊)**.' }] },
  ],
}
