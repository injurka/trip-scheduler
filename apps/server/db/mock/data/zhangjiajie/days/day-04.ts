import { DAY_IDS, getRoutePath, TRIP_ID } from '../constants'

export const MOCK_DAY_04 = {
  id: DAY_IDS.DAY_04,
  date: new Date('2025-10-22'),
  title: 'Путь в горы Аватара',
  description: 'Этот день — спокойный и логичный переезд из шумного мегаполиса в предгорье одного из самых знаменитых природных парков мира. Вы на личном опыте оцените удобство и скорость китайских поездов, ведь путь займет менее двух часов. День не предполагает активного осмотра достопримечательностей, его главная цель — комфортно сменить локацию и подготовиться к следующим, очень насыщенным дням. Вечерняя прогулка по городу Чжанцзяцзе позволит вам почувствовать его совершенно иную, более размеренную атмосферу по сравнению с Чаншой.',
  tripId: TRIP_ID,
  meta: [
    {
      id: 'e8f9a0b1-c2d3-4e5f-b6a7-b8c9d0e1f2a3',
      icon: 'mdi:walk',
      color: '#BDB2FF',
      title: 'Маршрутный темп',
      content: 'Низкий',
    },
    {
      id: 'a9b0c1d2-e3f4-4a5b-b6c7-d8e9f0a1b2c3',
      icon: 'mdi:currency-usd',
      color: '#A3D9A5',
      title: 'Финансовые затраты на день',
      content: '**Междугородний транспорт:** `~2 000 - 2 500` ₽.\n\n* *Что включено:* Билет на скоростной поезд от Чанши до Чжанцзяцзе (ориентировочно 150-250 юаней).\n\n<br />\n\n**Местный транспорт:** `~500 - 700` ₽.\n\n* *Что включено:* Поездка на метро до вокзала в Чанше и поездка на такси от вокзала до отеля в Чжанцзяцзе.\n\n<br />\n\n**Итого за день:** от `2 500 ₽` до `3 200 ₽` (без учета проживания и питания).',
      subtitle: 'от 2 500 ₽ до 3 200 ₽',
    },
  ],
  activities: [
    {
      id: 'b1c2d3e4-f5a6-4b7c-8d9e-a0b1c2d3e4f5',
      startTime: '10:30',
      endTime: '11:15',
      title: 'Неспешный подъем, завтрак и выселение из отеля',
      sections: [
        {
          id: 'c2d3e4f5-a6b7-4c8d-9e0f-b1c2d3e4f5a6',
          text: 'Насладитесь последним утром в Чанше. Позавтракайте, соберите вещи и сдайте номер. Ваш отель находится в самом центре, у площади Wuyi, а выселение необходимо сделать до 13:00, так что времени достаточно.',
          type: 'description',
        },
      ],
      tag: 'relax' as const,
      status: 'none' as const,
      rating: null,
      dayId: DAY_IDS.DAY_04,
    },
    {
      id: 'e28aa61d-3ab6-4db9-b137-caa2d84a04d2',
      startTime: '11:15',
      endTime: '12:00',
      title: 'Дорога на Южный вокзал Чанши',
      sections: [
        {
          id: 'e4f5a6b7-c8d9-4e0f-b1a2-c3d4e5f6a7b8',
          text: 'Удобнее всего добраться на метро. Ваш отель расположен прямо у станции **Wuyi Square (五一广场)**. Садитесь на Линию 2 (синяя ветка) в направлении Guangda (光达) и поезжайте до станции **Changsha South Railway Station (长沙火车南站)**. Поездка займет около 30 минут.\n\n<br />\n\n*Совет*: Выезжайте с запасом. Вокзал очень большой, и на вход, проверку безопасности и билетов может потребоваться время.\n\n<br />\n\n*Ссылка на локацию*: [Baidu Map](https://j.map.baidu.com/33/tBJ)\n',
          type: 'description',
        },
        {
          id: 'a6b7c8d9-e0f1-4a2b-b3c4-d5e6f7a8b9c1',
          type: 'gallery',
          imageUrls: [
            getRoutePath('20250916181548.png'),
            getRoutePath('20250916181640.png'),
          ],
        },
      ],
      tag: 'transport' as const,
      status: 'none' as const,
      rating: null,
      dayId: DAY_IDS.DAY_04,
    },
    {
      id: 'f5a6b7c8-d9e0-4f1a-b2b3-c4d5e6f7a8b9',
      startTime: '12:00',
      endTime: '13:05',
      title: 'Ожидание поезда G2436',
      sections: [
        {
          id: 'a6b7c8d9-e0f1-4a2b-b3c4-d5e6f7a8b9c0',
          text: 'Пройдите контроль, найдите свой выход на посадку (Gate) на большом табло и ожидайте начала посадки, которая обычно начинается за 15-20 минут до отправления. Можно купить воду и закуски в дорогу.',
          type: 'description',
        },
      ],
      tag: 'transport' as const,
      status: 'none' as const,
      rating: null,
      dayId: DAY_IDS.DAY_04,
    },
    {
      id: 'b7c8d9e0-f1a2-4b3c-b4d5-e6f7a8b9c0d1',
      startTime: '13:05',
      endTime: '14:57',
      title: 'Поездка на скоростном поезде в Чжанцзяцзе',
      sections: [
        {
          id: 'c8d9e0f1-a2b3-4c4d-b5e6-f7a8b9c0d1e2',
          text: 'Располагайтесь в комфортном кресле поезда G2436. Поездка будет быстрой и займет всего 1 час 52 минуты. За окном вы станете свидетелем символического перехода. Огни огромного Чанши быстро сменятся сельскими пейзажами провинции Хунань. По мере приближения к Чжанцзяцзе, ландшафт начнет меняться — вы едете в горы.\n\n<br />\n\n*Прибытие*: Ваш поезд прибудет на **Западный вокзал Чжанцзяцзе (Zhangjiajie West Station / 张家界西站)**.\n\n<br />\n\n*Ссылка на локацию*: [Baidu Map](https://j.map.baidu.com/9f/_sv)\n',
          type: 'description',
        },
        {
          id: 'd9e0f1a2-b3c4-4d5e-b6f7-a8b9c0d1e2f3',
          type: 'gallery',
          imageUrls: [
            getRoutePath('20251001164359.png'),
            getRoutePath('20250824230927.png'),
            getRoutePath('20250916181935.png'),
          ],
        },
        {
          id: 'df9d9f6e-177a-45ea-a542-8bbb113ffd62',
          type: 'geolocation',
          points: [
            {
              id: 'c668684d-cf3f-464e-bf79-8225f995440b',
              type: 'poi',
              style: {
                color: '#E6194B',
              },
              address: '大庸桥街道, Чжанцзяцзе, Юндин, Чжанцзяцзе, Хунань, 427000, Китай',
              comment: 'Zhangjiajie West Station\n',
              coordinates: [
                110.45910519833872,
                29.17228987735723,
              ],
            },
          ],
          routes: [],
          drawnRoutes: [],
        },
      ],
      tag: 'transport' as const,
      status: 'none' as const,
      rating: null,
      dayId: DAY_IDS.DAY_04,
    },
    {
      id: 'e0f1a2b3-c4d5-4e6f-b7a8-b9c0d1e2f3a4',
      startTime: '15:00',
      endTime: '15:45',
      title: 'Трансфер в отель Vienna 3 Best Hotel',
      sections: [
        {
          id: 'f1a2b3c4-d5e6-4f7a-b8b9-c0d1e2f3a4b5',
          text: 'На выходе из вокзала Чжанцзяцзе Западный найдите официальную стоянку такси. Поездка до вашего отеля, который находится рядом с нижней станцией канатной дороги на гору Тяньмэнь, займет около 20-25 минут.\n\n<br />\n\n*Совет*: Обязательно имейте при себе название и адрес отеля на китайском: **维也纳3好酒店(张家界天门山索道店)**.\n\n<br />\n\n*Ссылка на локацию*: [Baidu Map](https://map.baidu.com/?shareurl=1\\&poiShareUid=7a51b8dcf2aeeeba25d2bbeb)\n',
          type: 'description',
        },
        {
          id: 'a2b3c4d5-e6f7-4a8b-b9c0-d1e2f3a4b5c6',
          type: 'gallery',
          imageUrls: [
            getRoutePath('20250916184316.png'),
            getRoutePath('20250916184347.png'),
            getRoutePath('20250916184352.png'),
            getRoutePath('20250916184408.png'),
          ],
        },
        {
          id: '0de4d584-aea7-4b9b-8b1d-3119e4cd51b3',
          type: 'geolocation',
          points: [
            {
              id: '576867f6-dab6-4d66-b1b2-f3cf58e94968',
              type: 'poi',
              style: {
                color: '#E6194B',
              },
              address: '一品乐, 官黎路, 龙门社区, 官黎坪街道, Чжанцзяцзе, Юндин, Чжанцзяцзе, Хунань, 427000, Китай',
              comment: 'Vienna 3 Best Hotel\n',
              coordinates: [
                110.47935548725818,
                29.1095112269181,
              ],
            },
          ],
          routes: [],
          drawnRoutes: [],
        },
      ],
      tag: 'transport' as const,
      status: 'none' as const,
      rating: null,
      dayId: DAY_IDS.DAY_04,
    },
    {
      id: 'b3c4d5e6-f7a8-4b9c-b0d1-e2f3a4b5c6d7',
      startTime: '15:45',
      endTime: '17:00',
      title: 'Заселение в отель и отдых',
      sections: [
        {
          id: 'c4d5e6f7-a8b9-4cad-b1e2-f3a4b5c6d7e8',
          text: 'Разместитесь в номере (заселение возможно после 14:00), поставьте технику на зарядку и отдохните после переезда.',
          type: 'description',
        },
      ],
      tag: 'relax' as const,
      status: 'none' as const,
      rating: null,
      dayId: DAY_IDS.DAY_04,
    },
    {
      id: 'd5e6f7a8-b9c0-4dad-b2e3-f4a5b6c7d8e9',
      startTime: '17:00',
      endTime: '19:00',
      title: 'Прогулка и ужин в городе',
      sections: [
        {
          id: 'e6f7a8b9-c0d1-4ead-b3f4-a5b6c7d8e9f0',
          text: 'Ваш отель расположен в очень удачном месте. У вас будет достаточно времени, чтобы неспешно прогуляться по окрестностям, дойти до реки, найти ресторан и попробовать местную кухню. Заодно можно сориентироваться, где находится вход на канатную дорогу для вашего завтрашнего восхождения на гору Тяньмэнь.',
          type: 'description',
        },
      ],
      tag: 'food' as const,
      status: 'none' as const,
      rating: null,
      dayId: DAY_IDS.DAY_04,
    },
  ],
}
