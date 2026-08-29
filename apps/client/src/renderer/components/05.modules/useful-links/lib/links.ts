import type { ServiceLink } from '../models/types'

export const SERVICE_LINKS: ServiceLink[] = [
  // --- TRIP.COM ---
  {
    id: 'trip-com',
    name: 'Trip.com',
    url: 'https://www.trip.com/',
    description: 'Ведущее международное онлайн-турагентство. Главный сервис для бронирования поездов и отелей в Китае и по всей Азии с зарубежными картами.',
    categories: ['flights', 'hotels', 'transport', 'activities'],
    countries: ['china', 'taiwan', 'hong-kong', 'japan', 'south-korea', 'thailand', 'vietnam', 'global'],
    popularIn: ['china', 'hong-kong'],
    recommended: true,
    isGlobal: true,
    countryNotes: {
      'china': 'Номер 1 для Китая: гарантирует заселение иностранцев в отелях и позволяет легко покупать билеты на скоростные поезда без китайского номера.',
      'taiwan': 'Отличные предложения на отели в Тайбэе, Гаосюне и авиабилеты.',
      'hong-kong': 'Удобно бронировать отели и поезда High Speed Rail в материковый Китай.',
    },
    tags: ['агрегатор', 'отели', 'поезда', 'Китай', 'Азия', 'авиабилеты'],
  },

  // --- KLOOK ---
  {
    id: 'klook',
    name: 'Klook',
    url: 'https://www.klook.com/',
    description: 'Крупнейшая азиатская платформа для бронирования билетов со скидками, скоростных поездов, экскурсий, eSIM и трансферов.',
    categories: ['activities', 'transport', 'connectivity'],
    countries: ['taiwan', 'hong-kong', 'japan', 'south-korea', 'thailand', 'indonesia', 'vietnam', 'global'],
    popularIn: ['taiwan', 'hong-kong', 'japan', 'south-korea', 'thailand'],
    recommended: true,
    isGlobal: true,
    countryNotes: {
      'taiwan': 'Главный сервис в Тайване: эксклюзивные скидки 20% на поезда THSR, Taipei 101, EasyCard и трансферы из аэропорта Таоюань.',
      'hong-kong': 'Лучшие цены на Disneyland, Ocean Park, Peak Tram и Octopus Card.',
      'japan': 'Официальные билеты в Universal Studios Japan, teamLab, выставки и JR Pass.',
      'china': 'В материковом Китае выбор ограничен, лучше использовать Trip.com или локальные приложения.',
    },
    tags: ['билеты', 'экскурсии', 'скидки', 'Тайвань', 'Гонконг', 'Япония', 'Азия'],
  },

  // --- KKDAY ---
  {
    id: 'kkday',
    name: 'KKday',
    url: 'https://www.kkday.com/',
    description: 'Ведущий тайваньский сервис бронирования путешествий, однодневных туров, аренды авто, билетов на транспорт и уникальных местных активностей.',
    categories: ['activities', 'transport', 'connectivity'],
    countries: ['taiwan', 'japan', 'south-korea', 'hong-kong', 'thailand', 'global'],
    popularIn: ['taiwan'],
    recommended: true,
    countryNotes: {
      taiwan: 'Родной тайваньский сервис: самый широкий выбор туров в Тароко, Алишань, Цзюфэнь, аренда авто и билеты на скоростные поезда THSR.',
      japan: 'Отличные однодневные автобусные экскурсии из Токио к горе Фудзи и в Киото.',
    },
    tags: ['Тайвань', 'экскурсии', 'билеты', 'активности', 'Азия'],
  },

  // --- GOOGLE MAPS ---
  {
    id: 'google-maps',
    name: 'Google Maps',
    url: 'https://maps.google.com/',
    description: 'Мировой стандарт картографии: точная навигация, пешеходные маршруты, расписание общественного транспорта и отзывы о местах.',
    categories: ['maps'],
    countries: ['taiwan', 'hong-kong', 'japan', 'thailand', 'vietnam', 'indonesia', 'turkey', 'uae', 'europe', 'global'],
    popularIn: ['taiwan', 'hong-kong', 'japan', 'thailand', 'europe', 'global'],
    recommended: true,
    isGlobal: true,
    blockedIn: [
      {
        countryId: 'china',
        reason: 'Полностью заблокирован в материковом Китае «Великим файрволом». Без VPN не открывается, а координаты смещены (проблема GCJ-02). Используйте Gaode Maps или Apple Maps.',
      },
      {
        countryId: 'south-korea',
        reason: 'В Южной Корее не строит пешие и автомобильные маршруты из-за местного законодательства. Используйте Naver Map или KakaoMap.',
      },
    ],
    countryNotes: {
      'taiwan': 'Работает безупречно по всему острову: расписание автобусов, метро и поездов в реальном времени.',
      'hong-kong': 'Идеальная точность для MTR метро, автобусов и пешеходных переходов.',
      'japan': 'Очень удобен для поиска мест, но для сложных поездов лучше дополнять Japan Travel by NAVITIME.',
    },
    tags: ['карты', 'маршруты', 'навигация', 'онлайн'],
  },

  // --- GAODE MAPS (AMAP) ---
  {
    id: 'gaode-maps',
    name: 'Gaode Maps (Amap / 高德地图)',
    url: 'https://www.amap.com/',
    description: 'Главное навигационное приложение Китая №1. Точнейшая детализация городов, входов в метро, вызов такси и маршруты автобусов.',
    categories: ['maps', 'transport'],
    countries: ['china'],
    popularIn: ['china'],
    recommended: true,
    countryNotes: {
      china: 'Абсолютный мастхэв в Китае. Работает без VPN, максимально точные данные и навигация внутри торговых центров и вокзалов.',
    },
    tags: ['Китай', 'карты', 'навигация', 'топ', 'мастхэв'],
  },

  // --- APPLE MAPS ---
  {
    id: 'apple-maps',
    name: 'Apple Maps',
    url: 'https://maps.apple.com/',
    description: 'Встроенные карты Apple. В Китае используют локальные данные AutoNavi (Gaode) и работают без ограничений.',
    categories: ['maps'],
    countries: ['china', 'taiwan', 'hong-kong', 'japan', 'europe', 'global'],
    popularIn: ['china'],
    countryNotes: {
      china: 'Отличное решение для пользователей iPhone в Китае: работает без VPN, использует китайскую картографию Gaode и имеет интерфейс на русском/английском языке!',
      taiwan: 'Поддерживает детальные 3D-карты и транспорт в Тайбэе.',
    },
    tags: ['карты', 'Apple', 'iOS', 'Китай'],
  },

  // --- NAVER MAP ---
  {
    id: 'naver-map',
    name: 'Naver Map',
    url: 'https://map.naver.com/',
    description: 'Главный навигатор Южной Кореи. Поддерживает английский язык, строит точные пешие маршруты и показывает расписание метро и автобусов.',
    categories: ['maps', 'transport'],
    countries: ['south-korea'],
    popularIn: ['south-korea'],
    recommended: true,
    countryNotes: {
      'south-korea': 'Обязателен в Южной Корее вместо неработающего в режиме навигации Google Maps.',
    },
    tags: ['Корея', 'карты', 'навигация', 'мастхэв'],
  },

  // --- KAKAOMAP ---
  {
    id: 'kakao-map',
    name: 'KakaoMap',
    url: 'https://map.kakao.com/',
    description: 'Популярное корейское картографическое приложение с 3D-просмотром улиц, навигацией и интеграцией с экосистемой Kakao.',
    categories: ['maps'],
    countries: ['south-korea'],
    tags: ['Корея', 'карты', 'маршруты'],
  },

  // --- ALIPAY ---
  {
    id: 'alipay',
    name: 'Alipay (支付宝)',
    url: 'https://www.alipay.com/',
    description: 'Ключевое платежное приложение Китая. Позволяет иностранцам привязать зарубежные карты (Visa, Mastercard) для QR-оплаты в магазинах, такси и метро.',
    categories: ['payment', 'transport'],
    countries: ['china', 'hong-kong'],
    popularIn: ['china'],
    recommended: true,
    countryNotes: {
      china: 'Без Alipay в Китае практически невозможно расплатиться. Поддерживает оплату в метро через встроенный QR-код транспортной карты (Transport QR).',
    },
    tags: ['Китай', 'оплата', 'QR-код', 'мастхэв', 'метро'],
  },

  // --- WECHAT ---
  {
    id: 'wechat',
    name: 'WeChat (微信 / WeChat Pay)',
    url: 'https://www.wechat.com/',
    description: 'Главный мессенджер и цифровая среда Китая с поддержкой привязки зарубежных банковских карт к WeChat Pay и заказом еды в ресторанах по QR.',
    categories: ['payment', 'food', 'info'],
    countries: ['china'],
    popularIn: ['china'],
    recommended: true,
    countryNotes: {
      china: 'Во многих китайских ресторанах меню доступно только при сканировании QR-кода на столике через WeChat.',
    },
    tags: ['Китай', 'оплата', 'мессенджер', 'еда', 'QR-код'],
  },

  // --- DIDI ---
  {
    id: 'didi',
    name: 'DiDi (滴滴出行)',
    url: 'https://www.didiglobal.com/',
    description: 'Основной сервис вызова такси в Китае. Доступна англоязычная версия приложения с оплатой международными картами и встроенным переводчиком в чате.',
    categories: ['transport'],
    countries: ['china'],
    popularIn: ['china'],
    recommended: true,
    countryNotes: {
      china: 'Ловит такси моментально в любом городе Китая. Доступен также как мини-программа внутри Alipay.',
    },
    tags: ['Китай', 'такси', 'транспорт'],
  },

  // --- 12306 CHINA RAILWAY ---
  {
    id: '12306',
    name: '12306 China Railway (铁路12306)',
    url: 'https://www.12306.cn/',
    description: 'Официальный портал высокоскоростных железных дорог Китая. Доступна английская версия для покупки билетов без посредников по загранпаспорту.',
    categories: ['transport'],
    countries: ['china'],
    countryNotes: {
      china: 'Официальные цены без комиссии. Для входа на вокзал достаточно приложить загранпаспорт к турникету.',
    },
    tags: ['поезда', 'Китай', 'билеты', 'скоростной'],
  },

  // --- EASYCARD & IPASS ---
  {
    id: 'easycard',
    name: 'EasyCard (悠遊卡) & iPASS',
    url: 'https://www.easycard.com.tw/',
    description: 'Единая бесконтактная смарт-карта Тайваня для метро MRT, автобусов, пригородных поездов TRA, паромов и покупок в супермаркетах.',
    categories: ['payment', 'transport'],
    countries: ['taiwan'],
    popularIn: ['taiwan'],
    recommended: true,
    countryNotes: {
      taiwan: 'Покупается в любом 7-Eleven, FamilyMart или на станциях метро. Пополняется наличными купюрами.',
    },
    tags: ['Тайвань', 'метро', 'транспорт', 'карта', 'мастхэв'],
  },

  // --- TAIWAN HIGH SPEED RAIL ---
  {
    id: 'thsr',
    name: 'Taiwan High Speed Rail (THSR)',
    url: 'https://www.thsrc.com.tw/',
    description: 'Официальный сайт скоростных поездов Тайваня, соединяющих Тайбэй и Гаосюн за 90 минут со скоростью до 300 км/ч.',
    categories: ['transport'],
    countries: ['taiwan'],
    popularIn: ['taiwan'],
    recommended: true,
    countryNotes: {
      taiwan: 'Совет: для туристов билеты на THSR со скидками 20% выгоднее покупать через Klook или KKday!',
    },
    tags: ['Тайвань', 'поезда', 'скоростной', 'транспорт'],
  },

  // --- OCTOPUS CARD ---
  {
    id: 'octopus-card',
    name: 'Octopus Card (八達通)',
    url: 'https://www.octopus.com.hk/',
    description: 'Культовая бесконтактная карта Гонконга. Принимается во всем общественном транспорте, паромах, такси, ресторанах и магазинах.',
    categories: ['payment', 'transport'],
    countries: ['hong-kong'],
    popularIn: ['hong-kong'],
    recommended: true,
    countryNotes: {
      'hong-kong': 'На iPhone можно выпустить цифровую Octopus карту прямо в Apple Wallet без залога в приложении Octopus for Tourists.',
    },
    tags: ['Гонконг', 'оплата', 'метро', 'транспорт', 'мастхэв'],
  },

  // --- OPENRICE ---
  {
    id: 'openrice',
    name: 'OpenRice',
    url: 'https://www.openrice.com/',
    description: 'Главный ресторанный гид по Гонконгу и Азии: реальные отзывы, меню, фотографии блюд и бронирование столиков со скидками до 50%.',
    categories: ['food'],
    countries: ['hong-kong', 'taiwan', 'thailand'],
    popularIn: ['hong-kong'],
    recommended: true,
    countryNotes: {
      'hong-kong': 'Незаменим для поиска лучших димсамов, лапшичных со звездами Michelin и скрытых местных заведений.',
    },
    tags: ['Гонконг', 'еда', 'рестораны', 'скидки'],
  },

  // --- SUICA / PASMO ---
  {
    id: 'suica-pasmo',
    name: 'Suica & Pasmo (Япония)',
    url: 'https://www.jreast.co.jp/e/pass/suica.html',
    description: 'Японские транспортные IC-карты для поездок на метро, поездах JR, оплаты в магазинах 7-Eleven, Lawson и автоматах с напитками.',
    categories: ['payment', 'transport'],
    countries: ['japan'],
    popularIn: ['japan'],
    recommended: true,
    countryNotes: {
      japan: 'На iPhone добавьте Suica или Pasmo прямо в Apple Wallet (потребуется карта Mastercard/Amex/JCB).',
    },
    tags: ['Япония', 'транспорт', 'оплата', 'Suica', 'мастхэв'],
  },

  // --- JAPAN TRAVEL BY NAVITIME ---
  {
    id: 'navitime-japan',
    name: 'Japan Travel by NAVITIME',
    url: 'https://www.navitime.co.jp/pcweb/',
    description: 'Лучший навигатор по Японии: показывает точные номера платформ, вагоны для быстрой пересадки и фильтрует поезда под проездной JR Pass.',
    categories: ['maps', 'transport'],
    countries: ['japan'],
    popularIn: ['japan'],
    recommended: true,
    countryNotes: {
      japan: 'Идеально рассчитывает время на пересадки между сложными линиями токийского метро и синкансэнами.',
    },
    tags: ['Япония', 'поезда', 'маршруты', 'JR Pass'],
  },

  // --- TABELOG ---
  {
    id: 'tabelog',
    name: 'Tabelog',
    url: 'https://tabelog.com/en/',
    description: 'Самый строгий и авторитетный ресторанный рейтинг Японии. Рейтинг 3.5+ означает место высочайшего класса.',
    categories: ['food'],
    countries: ['japan'],
    popularIn: ['japan'],
    recommended: true,
    countryNotes: {
      japan: 'Не ищите 4.8 в Google Maps — японцы ставят объективные оценки именно на Tabelog. Топ-3% ресторанов имеют балл выше 3.5.',
    },
    tags: ['Япония', 'еда', 'рестораны', 'гид'],
  },

  // --- SMARTEX ---
  {
    id: 'smartex',
    name: 'SmartEX (Tokaido Sanyo Shinkansen)',
    url: 'https://smart-ex.jp/en/index.php',
    description: 'Официальный сервис бронирования синкансэнов по маршруту Токио — Киото — Осака — Хиросима с привязкой к вашей карте IC/Suica.',
    categories: ['transport'],
    countries: ['japan'],
    countryNotes: {
      japan: 'Позволяет забронировать место с багажом крупного размера (Oversized Baggage Area) на синкансэне.',
    },
    tags: ['Япония', 'синкансэн', 'поезда', 'билеты'],
  },

  // --- KAKAO T ---
  {
    id: 'kakao-t',
    name: 'Kakao T',
    url: 'https://www.kakaocorp.com/page/service/service/KakaoT',
    description: 'Крупнейший сервис заказа такси и проката электросамокатов и велосипедов в Южной Корее.',
    categories: ['transport'],
    countries: ['south-korea'],
    popularIn: ['south-korea'],
    recommended: true,
    countryNotes: {
      'south-korea': 'Работает по всей Корее, есть опция оплаты водителю наличными или иностранной картой (General Request).',
    },
    tags: ['Корея', 'такси', 'транспорт'],
  },

  // --- WOWPASS ---
  {
    id: 'wowpass',
    name: 'WOWPASS',
    url: 'https://www.wowpass.io/',
    description: 'Универсальная предоплаченная карта для туристов в Южной Корее: объединяет оплату покупок и встроенную транспортную карту T-money.',
    categories: ['payment', 'transport'],
    countries: ['south-korea'],
    popularIn: ['south-korea'],
    recommended: true,
    countryNotes: {
      'south-korea': 'Пополняется наличными долларами, евро или иенами по выгодному курсу в оранжевых терминалах WOWPASS в аэропортах и отелях.',
    },
    tags: ['Корея', 'карта', 'оплата', 'T-money'],
  },

  // --- GRAB ---
  {
    id: 'grab',
    name: 'Grab',
    url: 'https://www.grab.com/',
    description: 'Супер-апп №1 в Юго-Восточной Азии: такси, байк-такси, доставка еды GrabFood и безналичная оплата GrabPay.',
    categories: ['transport', 'food', 'payment'],
    countries: ['thailand', 'vietnam', 'indonesia', 'global'],
    popularIn: ['thailand', 'vietnam', 'indonesia'],
    recommended: true,
    countryNotes: {
      thailand: 'Основное приложение для передвижения по Бангкоку, Пхукету, Самуи и Чиангмаю.',
      vietnam: 'Самый быстрый способ вызвать байк или такси по фиксированной цене без торга.',
      indonesia: 'Широко распространен на Бали и по всей Индонезии.',
    },
    tags: ['такси', 'Азия', 'еда', 'доставка', 'мастхэв'],
  },

  // --- BOLT ---
  {
    id: 'bolt',
    name: 'Bolt',
    url: 'https://bolt.eu/',
    description: 'Международный сервис вызова такси и аренды самокатов. В Таиланде и Европе часто выгоднее конкурентов.',
    categories: ['transport'],
    countries: ['thailand', 'europe', 'global'],
    countryNotes: {
      thailand: 'В Бангкоке и Паттайе поездки через Bolt часто стоят на 20–30% дешевле, чем в Grab.',
    },
    tags: ['такси', 'бюджетно', 'транспорт'],
  },

  // --- 12GO ASIA ---
  {
    id: '12go-asia',
    name: '12Go Asia',
    url: 'https://12go.asia/',
    description: 'Главный транспортный агрегатор Азии: бронирование паромов между островами, поездов, слипбасов и микроавтобусов.',
    categories: ['transport'],
    countries: ['thailand', 'vietnam', 'indonesia', 'global'],
    popularIn: ['thailand', 'vietnam'],
    recommended: true,
    countryNotes: {
      thailand: 'Лучший способ купить билеты на паромы Seatran, Lomprayah на острова Самуи, Пханган и Тао.',
      vietnam: 'Удобное расписание и билеты на поезда между Ханоем, Данангом и Хошимином.',
    },
    tags: ['паромы', 'поезда', 'автобусы', 'Азия', 'билеты'],
  },

  // --- GOJEK ---
  {
    id: 'gojek',
    name: 'Gojek',
    url: 'https://www.gojek.com/',
    description: 'Главный индонезийский супер-апп: байк-такси GoRide, авто GoCar, лучшая доставка еды GoFood и массаж GoMassage на Бали.',
    categories: ['transport', 'food', 'payment'],
    countries: ['indonesia'],
    popularIn: ['indonesia'],
    recommended: true,
    countryNotes: {
      indonesia: 'Мастхэв для жизни и отдыха на Бали: водители байков приезжают за пару минут.',
    },
    tags: ['Бали', 'Индонезия', 'такси', 'еда', 'доставка'],
  },

  // --- AGODA ---
  {
    id: 'agoda',
    name: 'Agoda',
    url: 'https://www.agoda.com/',
    description: 'Крупнейший сервис бронирования отелей, вилл и резортов в Азиатско-Тихоокеанском регионе с большими скидками по VIP-программе.',
    categories: ['hotels', 'flights'],
    countries: ['thailand', 'japan', 'south-korea', 'vietnam', 'indonesia', 'taiwan', 'global'],
    popularIn: ['thailand', 'vietnam', 'japan', 'south-korea'],
    recommended: true,
    isGlobal: true,
    countryNotes: {
      thailand: 'В Таиланде и ЮВА имеет самый широкий ассортимент отелей и бунгало по лучшим ценам.',
      japan: 'Отличные предложения на традиционные рёканы и отели в Токио и Осаке.',
    },
    tags: ['отели', 'скидки', 'Азия', 'курорты'],
  },

  // --- AIRALO ---
  {
    id: 'airalo',
    name: 'Airalo (eSIM)',
    url: 'https://www.airalo.com/',
    description: 'Первый и крупнейший магазин виртуальных eSIM-карт для 200+ стран мира с мгновенной установкой через QR-код.',
    categories: ['connectivity'],
    countries: ['china', 'taiwan', 'hong-kong', 'japan', 'south-korea', 'thailand', 'vietnam', 'indonesia', 'turkey', 'uae', 'europe', 'global'],
    popularIn: ['china', 'global'],
    recommended: true,
    isGlobal: true,
    countryNotes: {
      china: 'Главный лайфхак: роуминговая eSIM от Airalo обходит китайские блокировки — Google Maps, Instagram, Telegram и WhatsApp работают без стороннего VPN!',
      taiwan: 'Быстрый 5G интернет по всему Тайваню с моментальным подключением.',
    },
    tags: ['eSIM', 'интернет', 'роуминг', 'связь', 'VPN'],
  },

  // --- NOMAD ESIM ---
  {
    id: 'nomad-esim',
    name: 'Nomad eSIM',
    url: 'https://www.getnomad.app/',
    description: 'Надежный сервис покупки региональных и глобальных пакетов мобильного интернета eSIM по выгодным тарифам.',
    categories: ['connectivity'],
    countries: ['global', 'china', 'japan', 'europe', 'taiwan'],
    isGlobal: true,
    countryNotes: {
      china: 'Также предоставляет нефильтруемый трафик в роуминге для Китая.',
    },
    tags: ['eSIM', 'интернет', 'роуминг'],
  },

  // --- BOOKING.COM ---
  {
    id: 'booking-com',
    name: 'Booking.com',
    url: 'https://www.booking.com/',
    description: 'Мировой лидер онлайн-бронирования гостиниц, апартаментов, хостелов и гостевых домов.',
    categories: ['hotels'],
    countries: ['europe', 'taiwan', 'japan', 'thailand', 'global'],
    popularIn: ['europe', 'global'],
    recommended: true,
    isGlobal: true,
    blockedIn: [
      {
        countryId: 'russia',
        reason: 'Приостановил бронирование объектов размещения внутри Российской Федерации.',
      },
    ],
    countryNotes: {
      europe: 'Максимальная база вариантов и бесплатная отмена бронирования в большинстве объектов.',
      china: 'Внимание: в Китае на Booking много объектов без разрешения принимать иностранцев. Лучше бронировать через Trip.com.',
    },
    tags: ['отели', 'апартаменты', 'Европа', 'Мир'],
  },

  // --- AIRBNB ---
  {
    id: 'airbnb',
    name: 'Airbnb',
    url: 'https://www.airbnb.com/',
    description: 'Популярная платформа для аренды квартир, домов, вилл и комнат напрямую у местных хозяев.',
    categories: ['hotels', 'activities'],
    countries: ['europe', 'taiwan', 'japan', 'global'],
    isGlobal: true,
    blockedIn: [
      {
        countryId: 'russia',
        reason: 'Прекратил работу в России и Беларуси.',
      },
      {
        countryId: 'china',
        reason: 'Закрыл бизнес по внутренней аренде жилья в материковом Китае в 2022 году.',
      },
    ],
    countryNotes: {
      taiwan: 'Большой выбор стильных квартир в центре Тайбэя и Тайнаня.',
      japan: 'Все объекты в Японии имеют официальную лицензию Minpaku (номер указан в объявлении).',
    },
    tags: ['квартиры', 'аренда', 'дома', 'долгосрочно'],
  },

  // --- AVIASALES ---
  {
    id: 'aviasales',
    name: 'Aviasales',
    url: 'https://www.aviasales.ru/',
    description: 'Популярнейший поисковик дешевых авиабилетов с гибким поиском, календарем низких цен и оплатой российскими картами.',
    categories: ['flights'],
    countries: ['russia', 'global'],
    popularIn: ['russia'],
    recommended: true,
    countryNotes: {
      russia: 'Главный поисковик билетов для путешественников из РФ с удобной оплатой картами МИР.',
    },
    tags: ['авиабилеты', 'агрегатор', 'дешево', 'Россия'],
  },

  // --- SKYSCANNER ---
  {
    id: 'skyscanner',
    name: 'Skyscanner',
    url: 'https://www.skyscanner.com/',
    description: 'Глобальный метапоисковик авиабилетов, отелей и проката автомобилей с функцией поиска «Везде» на любую дату.',
    categories: ['flights'],
    countries: ['europe', 'global'],
    isGlobal: true,
    tags: ['авиабилеты', 'поиск везде', 'агрегатор'],
  },

  // --- GOOGLE FLIGHTS ---
  {
    id: 'google-flights',
    name: 'Google Flights',
    url: 'https://www.google.com/flights',
    description: 'Мгновенный поисковик авиабилетов от Google с графиком истории цен, предсказанием подорожания и картой перелетов Explore.',
    categories: ['flights'],
    countries: ['global', 'europe', 'taiwan', 'japan'],
    recommended: true,
    isGlobal: true,
    blockedIn: [
      {
        countryId: 'china',
        reason: 'Заблокирован в Китае без использования VPN.',
      },
    ],
    tags: ['авиабилеты', 'календарь цен', 'Google'],
  },

  // --- GETYOURGUIDE ---
  {
    id: 'getyourguide',
    name: 'GetYourGuide',
    url: 'https://www.getyourguide.com/',
    description: 'Крупнейшая платформа бронирования туров, аудиогидов и входных билетов в музеи и достопримечательности Европы и мира.',
    categories: ['activities'],
    countries: ['europe', 'uae', 'global'],
    popularIn: ['europe', 'uae'],
    recommended: true,
    isGlobal: true,
    countryNotes: {
      europe: 'Идеален для покупки билетов без очереди в Ватикан, Лувр, Колизей и Саграда Фамилия.',
    },
    tags: ['экскурсии', 'Европа', 'билеты', 'музеи'],
  },

  // --- OMIO ---
  {
    id: 'omio',
    name: 'Omio',
    url: 'https://www.omio.com/',
    description: 'Единая поисковая система для поездов, автобусов и самолетов по всей Европе с бронированием на одном понятном языке.',
    categories: ['transport', 'flights'],
    countries: ['europe'],
    popularIn: ['europe'],
    recommended: true,
    countryNotes: {
      europe: 'Объединяет билеты немецких DB, французских SNCF, итальянских Trenitalia, испанских Renfe и автобусов FlixBus.',
    },
    tags: ['поезда', 'автобусы', 'Европа', 'билеты'],
  },

  // --- FLIXBUS ---
  {
    id: 'flixbus',
    name: 'FlixBus',
    url: 'https://www.flixbus.com/',
    description: 'Крупнейшая бюджетная автобусная сеть Европы с Wi-Fi, розетками и прямыми рейсами между тысячами городов.',
    categories: ['transport'],
    countries: ['europe', 'global'],
    countryNotes: {
      europe: 'Самый дешевый способ путешествовать между европейскими столицами и городами.',
    },
    tags: ['автобусы', 'бюджетно', 'Европа'],
  },

  // --- BITAKSI (TURKEY) ---
  {
    id: 'bitaksi',
    name: 'BiTaksi',
    url: 'https://www.bitaksi.com/',
    description: 'Главное турецкое приложение для вызова лицензированных такси в Стамбуле и Анкаре с прозрачным расчетом стоимости.',
    categories: ['transport'],
    countries: ['turkey'],
    popularIn: ['turkey'],
    recommended: true,
    countryNotes: {
      turkey: 'Помогает избежать обмана таксистов в Стамбуле благодаря поездкам по счетчику и безналичной оплате.',
    },
    tags: ['Турция', 'Стамбул', 'такси', 'транспорт'],
  },

  // --- CAREEM (UAE) ---
  {
    id: 'careem',
    name: 'Careem',
    url: 'https://www.careem.com/',
    description: 'Главный супер-апп Ближнего Востока: заказ официального дубайского такси Hala Taxi, премиум-авто, доставка еды и аренда велосипедов Careem BIKE.',
    categories: ['transport', 'food', 'payment'],
    countries: ['uae'],
    popularIn: ['uae'],
    recommended: true,
    countryNotes: {
      uae: 'Самый удобный способ передвигаться по Дубаю на государственном такси Hala Taxi по официальному счетчику RTA.',
    },
    tags: ['ОАЭ', 'Дубай', 'такси', 'доставка'],
  },

  // --- YANDEX MAPS ---
  {
    id: 'yandex-maps',
    name: 'Яндекс Карты',
    url: 'https://yandex.ru/maps/',
    description: 'Детальные карты с отображением онлайн-движения транспорта, пробками, панорамами улиц и маршрутами.',
    categories: ['maps', 'transport'],
    countries: ['russia', 'turkey', 'global'],
    popularIn: ['russia', 'turkey'],
    recommended: true,
    countryNotes: {
      russia: 'Главный навигатор по России: точные маршруты, расписание и вызов такси Яндекс Go.',
      turkey: 'Отличная детализация Стамбула и Антальи с точным общественным транспортом.',
    },
    tags: ['карты', 'навигация', 'Россия', 'Турция', 'транспорт'],
  },

  // --- 2GIS ---
  {
    id: '2gis',
    name: '2ГИС',
    url: 'https://2gis.ru/',
    description: 'Подробный справочник с 3D-картами городов, входами в здания, поэтажными планами торговых центров и офлайн-навигацией.',
    categories: ['maps'],
    countries: ['russia', 'uae', 'global'],
    popularIn: ['russia', 'uae'],
    recommended: true,
    countryNotes: {
      russia: 'Показывает, в какую дверь зайти и на каком этаже находится нужная организация.',
      uae: 'Отлично детализированный справочник Дубая с полной поддержкой русского языка.',
    },
    tags: ['карты', 'справочник', 'офлайн', 'Россия', 'Дубай'],
  },

  // --- OSTROVOK ---
  {
    id: 'ostrovok',
    name: 'Островок (Ostrovok.ru)',
    url: 'https://ostrovok.ru/',
    description: 'Ведущий российский сервис бронирования отелей, апартаментов и хостелов по России и в 220 странах с оплатой российскими картами.',
    categories: ['hotels'],
    countries: ['russia', 'global'],
    popularIn: ['russia'],
    recommended: true,
    countryNotes: {
      russia: 'Основная замена Booking.com для путешествий по России и за рубеж с картами МИР.',
    },
    tags: ['отели', 'Россия', 'бронирование'],
  },

  // --- RZD ---
  {
    id: 'rzd',
    name: 'РЖД Пассажирам',
    url: 'https://www.rzd.ru/',
    description: 'Официальный портал покупки электронных билетов на поезда дальнего следования и «Сапсаны» по России.',
    categories: ['transport'],
    countries: ['russia'],
    popularIn: ['russia'],
    recommended: true,
    tags: ['поезда', 'РЖД', 'Россия', 'билеты'],
  },

  // --- ORGANIC MAPS ---
  {
    id: 'organic-maps',
    name: 'Organic Maps',
    url: 'https://organicmaps.app/',
    description: 'Быстрые и конфиденциальные офлайн-карты на базе OpenStreetMap без рекламы, слежки и интернета.',
    categories: ['maps'],
    countries: ['global'],
    recommended: true,
    isGlobal: true,
    countryNotes: {
      global: 'Незаменимы в походах, трекинге в горах и при отсутствии интернета.',
    },
    tags: ['офлайн', 'карты', 'OSM', 'без интернета'],
  },

  // --- CHEREHAPA ---
  {
    id: 'cherehapa',
    name: 'Cherehapa',
    url: 'https://cherehapa.ru/',
    description: 'Онлайн-агрегатор туристических медицинских страховок: сравнение условий десятков страховых компаний.',
    categories: ['info'],
    countries: ['russia', 'global'],
    popularIn: ['russia'],
    recommended: true,
    countryNotes: {
      russia: 'Быстрое оформление страховки для шенгенских и азиатских виз с оплатой российскими картами.',
    },
    tags: ['страхование', 'визы', 'здоровье'],
  },

  // --- SAFETYWING ---
  {
    id: 'safetywing',
    name: 'SafetyWing Nomad Insurance',
    url: 'https://safetywing.com/',
    description: 'Международная медицинская страховка по подписке для цифровых кочевников и путешественников, действующая по всему миру.',
    categories: ['info'],
    countries: ['global'],
    isGlobal: true,
    tags: ['страхование', 'кочевники', 'номады', 'долгосрочно'],
  },

  // --- XE CURRENCY ---
  {
    id: 'xe-currency',
    name: 'XE Currency Converter',
    url: 'https://www.xe.com/',
    description: 'Самый точный конвертер валют и графики курсов в реальном времени с поддержкой работы в офлайне.',
    categories: ['payment', 'info'],
    countries: ['global'],
    isGlobal: true,
    tags: ['валюта', 'конвертер', 'курсы'],
  },

  // --- FORUM VINSKOGO ---
  {
    id: 'forum-vinskogo',
    name: 'Форум Винского',
    url: 'https://forum.awd.ru/',
    description: 'Крупнейший русскоязычный форум самостоятельных путешественников с актуальными отчетами, визовыми вопросами и маршрутами.',
    categories: ['info'],
    countries: ['russia', 'global'],
    popularIn: ['russia'],
    recommended: true,
    countryNotes: {
      global: 'Первое место для поиска ответов на сложные вопросы: пересечение границ, визы, банковские карты и свежий опыт туристов.',
    },
    tags: ['форум', 'визы', 'советы', 'опыт'],
  },
]
