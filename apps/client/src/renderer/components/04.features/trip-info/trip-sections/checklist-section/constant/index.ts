import type { ChecklistPreset } from '../models/types'

const HARDCODED_PRESETS: ChecklistPreset[] = [
  // ==========================================
  // Вкладка: ПОДГОТОВКА (Packing lists)
  // ==========================================
  {
    id: 'universal-trip',
    name: 'Универсальная поездка',
    description: 'Базовый набор вещей: документы, аптечка, техника.',
    icon: 'mdi:bag-suitcase',
    tab: 'preparation',
    groups: [
      {
        name: 'Документы и деньги',
        icon: 'mdi:passport',
        items: [
          { text: 'Паспорта / Загранпаспорта', priority: 5 },
          { text: 'Билеты (распечатать или скачать)', priority: 5 },
          { text: 'Бронь отеля / жилья', priority: 4 },
          { text: 'Наличные деньги / Валюта', priority: 4 },
          { text: 'Банковские карты', priority: 5 },
          { text: 'Медицинская страховка', priority: 4 },
        ],
      },
      {
        name: 'Аптечка',
        icon: 'mdi:medical-bag',
        items: [
          { text: 'Обезболивающее', priority: 3 },
          { text: 'Пластыри (набор)', priority: 2 },
          { text: 'Жаропонижающее', priority: 3 },
          { text: 'Средства от расстройства желудка', priority: 3 },
          { text: 'Личные лекарства (хронические)', priority: 5 },
          { text: 'Антисептик', priority: 2 },
        ],
      },
      {
        name: 'Техника',
        icon: 'mdi:cellphone-charging',
        items: [
          { text: 'Телефон и зарядка', priority: 5 },
          { text: 'Пауэрбанк', priority: 4 },
          { text: 'Наушники', priority: 2 },
          { text: 'Переходник для розетки (если нужен)', priority: 3 },
        ],
      },
      {
        name: 'Гигиена',
        icon: 'mdi:toothbrush',
        items: [
          { text: 'Зубная щетка и паста', priority: 5 },
          { text: 'Дезодорант', priority: 4 },
          { text: 'Шампунь / Гель (мини-формат)', priority: 3 },
          { text: 'Расческа', priority: 3 },
        ],
      },
    ],
  },
  {
    id: 'home-check',
    name: 'Перед выходом из дома',
    description: 'Безопасность квартиры: вода, газ, окна и мусор.',
    icon: 'mdi:home-lock',
    tab: 'preparation',
    groups: [
      {
        name: 'Безопасность',
        icon: 'mdi:shield-check',
        items: [
          { text: 'Перекрыть воду', priority: 5 },
          { text: 'Перекрыть газ', priority: 5 },
          { text: 'Закрыть все окна и форточки', priority: 5 },
          { text: 'Выключить все электроприборы из розеток', priority: 4 },
          { text: 'Проверить свет во всех комнатах', priority: 3 },
        ],
      },
      {
        name: 'Быт',
        icon: 'mdi:delete-empty',
        items: [
          { text: 'Вынести мусор', priority: 4 },
          { text: 'Полить цветы', priority: 3 },
          { text: 'Очистить холодильник от скоропорта', priority: 3 },
          { text: 'Оставить еду/воду питомцу (если остается)', priority: 5 },
          { text: 'Взять ключи от дома', priority: 5 },
        ],
      },
    ],
  },
  {
    id: 'business-trip',
    name: 'Командировка',
    description: 'Для работы: ноутбук, костюм, документы.',
    icon: 'mdi:briefcase-account',
    tab: 'preparation',
    groups: [
      {
        name: 'Работа',
        icon: 'mdi:laptop',
        items: [
          { text: 'Ноутбук + зарядное устройство', priority: 5 },
          { text: 'Флешка / Жесткий диск', priority: 3 },
          { text: 'Блокнот и ручка', priority: 2 },
          { text: 'Визитки', priority: 3 },
          { text: 'Пропуск / Бейдж', priority: 5 },
        ],
      },
      {
        name: 'Официальный стиль',
        icon: 'mdi:tie',
        items: [
          { text: 'Рубашки / Блузки (погладить)', priority: 4 },
          { text: 'Костюм / Пиджак', priority: 4 },
          { text: 'Туфли / Строгая обувь', priority: 4 },
          { text: 'Ремень', priority: 3 },
          { text: 'Отпариватель (ручной)', priority: 2 },
        ],
      },
    ],
  },
  {
    id: 'road-trip-pack',
    name: 'Сборы в автопутешествие',
    description: 'Что взять с собой в машину.',
    icon: 'mdi:car-convertible',
    tab: 'preparation',
    groups: [
      {
        name: 'Автомобиль',
        icon: 'mdi:car-wrench',
        items: [
          { text: 'Водительские права и СТС', priority: 5 },
          { text: 'Страховка на авто', priority: 5 },
          { text: 'Запасное колесо (проверить давление)', priority: 4 },
          { text: 'Домкрат и балонный ключ', priority: 4 },
          { text: 'Омывайка / Вода', priority: 3 },
          { text: 'Трос и провода для прикуривания', priority: 3 },
        ],
      },
      {
        name: 'В дорогу',
        icon: 'mdi:coffee-to-go',
        items: [
          { text: 'Термос с кофе/чаем', priority: 3 },
          { text: 'Вода (5л)', priority: 4 },
          { text: 'Снеки / Бутерброды', priority: 3 },
          { text: 'Влажные салфетки (большая пачка)', priority: 4 },
          { text: 'Плейлист / Аудиокниги (скачать)', priority: 2 },
          { text: 'Держатель для телефона', priority: 4 },
        ],
      },
    ],
  },
  {
    id: 'beach-vacation',
    name: 'Пляжный отдых',
    description: 'Все для моря, солнца и песка.',
    icon: 'mdi:beach',
    tab: 'preparation',
    groups: [
      {
        name: 'Пляжные принадлежности',
        icon: 'mdi:umbrella-beach',
        items: [
          { text: 'Купальник / Плавки (2 пары)', priority: 5 },
          { text: 'Солнцезащитный крем (SPF 30-50)', priority: 5 },
          { text: 'Средство после загара (Пантенол)', priority: 4 },
          { text: 'Солнечные очки', priority: 4 },
          { text: 'Головной убор (кепка/шляпа)', priority: 5 },
          { text: 'Пляжное полотенце / Покрывало', priority: 3 },
          { text: 'Шлепанцы', priority: 4 },
          { text: 'Водонепроницаемый чехол для телефона', priority: 2 },
        ],
      },
      {
        name: 'Одежда',
        icon: 'mdi:tshirt-crew',
        items: [
          { text: 'Легкие футболки / Майки', priority: 3 },
          { text: 'Шорты', priority: 3 },
          { text: 'Легкая обувь для прогулок (сандалии)', priority: 4 },
          { text: 'Накидка / Парео', priority: 2 },
        ],
      },
    ],
  },
  {
    id: 'winter-sports',
    name: 'Зимний спорт',
    description: 'Лыжи, сноуборд и теплые вещи.',
    icon: 'mdi:snowflake',
    tab: 'preparation',
    groups: [
      {
        name: 'Экипировка',
        icon: 'mdi:ski',
        items: [
          { text: 'Горнолыжная маска / Очки', priority: 5 },
          { text: 'Перчатки / Варежки (непромокаемые)', priority: 5 },
          { text: 'Шлем', priority: 5 },
          { text: 'Балаклава / Бафф', priority: 4 },
          { text: 'Сушилка для обуви', priority: 3 },
          { text: 'Ски-пасс (если есть)', priority: 4 },
        ],
      },
      {
        name: 'Одежда',
        icon: 'mdi:tshirt-v-outline',
        items: [
          { text: 'Термобелье (верх и низ)', priority: 5 },
          { text: 'Флисовая кофта', priority: 4 },
          { text: 'Горнолыжные носки (2-3 пары)', priority: 4 },
          { text: 'Мембранная куртка и штаны', priority: 5 },
        ],
      },
      {
        name: 'Защита кожи',
        icon: 'mdi:face-man',
        items: [
          { text: 'Крем от ветра и мороза', priority: 3 },
          { text: 'Гигиеническая помада (с SPF)', priority: 4 },
        ],
      },
    ],
  },
  {
    id: 'hiking-trip',
    name: 'Поход с палатками',
    description: 'Снаряжение для выживания в лесу или горах.',
    icon: 'mdi:forest',
    tab: 'preparation',
    groups: [
      {
        name: 'Лагерь',
        icon: 'mdi:tent',
        items: [
          { text: 'Палатка', priority: 5 },
          { text: 'Спальник (по погоде)', priority: 5 },
          { text: 'Коврик (пенка/надувной)', priority: 4 },
          { text: 'Фонарик налобный + запасные батарейки', priority: 4 },
          { text: 'Нож / Мультитул', priority: 4 },
          { text: 'Сидушка (пендаль)', priority: 3 },
        ],
      },
      {
        name: 'Кухня',
        icon: 'mdi:campfire',
        items: [
          { text: 'Газовая горелка + баллон', priority: 5 },
          { text: 'Котелок', priority: 4 },
          { text: 'КЛМН (Кружка, Ложка, Миска, Нож)', priority: 5 },
          { text: 'Спички (охотничьи) / Зажигалка', priority: 5 },
          { text: 'Вода (запас) / Фильтр для воды', priority: 5 },
          { text: 'Пакеты для мусора', priority: 4 },
        ],
      },
      {
        name: 'Навигация и связь',
        icon: 'mdi:map-legend',
        items: [
          { text: 'Офлайн карты (скачать регион)', priority: 5 },
          { text: 'Компас', priority: 2 },
          { text: 'Свисток (для сигналов)', priority: 2 },
        ],
      },
    ],
  },
  {
    id: 'travel-with-kids',
    name: 'Поездка с детьми',
    description: 'Важное для маленьких путешественников.',
    icon: 'mdi:baby-carriage',
    tab: 'preparation',
    groups: [
      {
        name: 'В дороге',
        icon: 'mdi:toy-brick',
        items: [
          { text: 'Любимая игрушка', priority: 4 },
          { text: 'Планшет с мультфильмами + наушники', priority: 3 },
          { text: 'Снеки / Пюре / Печенье', priority: 5 },
          { text: 'Вода-непроливайка', priority: 5 },
          { text: 'Сменная одежда (в ручную кладь)', priority: 5 },
        ],
      },
      {
        name: 'Гигиена малыша',
        icon: 'mdi:baby-bottle-outline',
        items: [
          { text: 'Подгузники (с запасом)', priority: 5 },
          { text: 'Влажные салфетки (большая пачка)', priority: 5 },
          { text: 'Одноразовые пеленки', priority: 3 },
          { text: 'Крем под подгузник', priority: 3 },
          { text: 'Горшок (дорожный)', priority: 2 },
        ],
      },
      {
        name: 'Детская аптечка',
        icon: 'mdi:medical-bag',
        items: [
          { text: 'Жаропонижающее (детское)', priority: 5 },
          { text: 'Антигистаминное', priority: 4 },
          { text: 'Градусник', priority: 4 },
          { text: 'Средство для регидратации', priority: 3 },
        ],
      },
    ],
  },
  {
    id: 'hostel-trip',
    name: 'Бэкпэкинг / Хостел',
    description: 'Налегке: безопасность вещей и комфорт в общей комнате.',
    icon: 'mdi:bag-personal',
    tab: 'preparation',
    groups: [
      {
        name: 'Комфорт и сон',
        icon: 'mdi:bed-empty',
        items: [
          { text: 'Беруши (обязательно)', priority: 5 },
          { text: 'Маска для сна', priority: 5 },
          { text: 'Полотенце из микрофибры (сохнет быстро)', priority: 4 },
          { text: 'Шлепанцы для душа', priority: 5 },
        ],
      },
      {
        name: 'Безопасность',
        icon: 'mdi:lock',
        items: [
          { text: 'Навесной замок для шкафчика', priority: 5 },
          { text: 'Поясная сумка для документов', priority: 4 },
        ],
      },
    ],
  },

  // ==========================================
  // Вкладка: В ПУТЕШЕСТВИИ (Actions & Checks)
  // ==========================================
  {
    id: 'hotel-check-in',
    name: 'Заселение в отель',
    description: 'Что проверить сразу после входа в номер.',
    icon: 'mdi:key-chain',
    tab: 'in-trip',
    groups: [
      {
        name: 'Проверка номера',
        icon: 'mdi:bed-king-outline',
        items: [
          { text: 'Проверить чистоту постельного белья', priority: 5 },
          { text: 'Убедиться в наличии горячей воды', priority: 4 },
          { text: 'Проверить кондиционер / отопление', priority: 4 },
          { text: 'Узнать пароль от Wi-Fi', priority: 3 },
          { text: 'Проверить розетки (заряжается ли телефон)', priority: 3 },
        ],
      },
      {
        name: 'Организационное',
        icon: 'mdi:information-outline',
        items: [
          { text: 'Уточнить время завтрака', priority: 3 },
          { text: 'Взять визитку отеля (адрес на местном)', priority: 5 },
          { text: 'Узнать про камеру хранения багажа', priority: 2 },
        ],
      },
    ],
  },
  {
    id: 'hotel-check-out',
    name: 'Выезд из отеля',
    description: 'Чтобы ничего не забыть и не переплатить.',
    icon: 'mdi:door-open',
    tab: 'in-trip',
    groups: [
      {
        name: 'Сборы',
        icon: 'mdi:bag-suitcase-outline',
        items: [
          { text: 'Заглянуть под кровать', priority: 4 },
          { text: 'Проверить сейф (паспорт, деньги!)', priority: 5 },
          { text: 'Проверить ванную (щетки, косметика)', priority: 4 },
          { text: 'Забрать зарядки из розеток', priority: 5 },
        ],
      },
      {
        name: 'Формальности',
        icon: 'mdi:receipt-text-outline',
        items: [
          { text: 'Сдать ключ от номера', priority: 5 },
          { text: 'Проверить счет мини-бара', priority: 3 },
          { text: 'Забрать депозит (если оставляли)', priority: 4 },
        ],
      },
    ],
  },
  {
    id: 'car-rental-check',
    name: 'Приемка арендованного авто',
    description: 'Важный чек-лист, чтобы избежать штрафов.',
    icon: 'mdi:car-search',
    tab: 'in-trip',
    groups: [
      {
        name: 'Внешний осмотр',
        icon: 'mdi:car-door',
        items: [
          { text: 'Сфотографировать все существующие царапины', priority: 5 },
          { text: 'Проверить стекла на трещины и сколы', priority: 5 },
          { text: 'Осмотреть состояние шин', priority: 4 },
          { text: 'Проверить уровень топлива', priority: 5 },
        ],
      },
      {
        name: 'Внутри',
        icon: 'mdi:steering',
        items: [
          { text: 'Проверить работу кондиционера', priority: 4 },
          { text: 'Проверить фары и поворотники', priority: 5 },
          { text: 'Наличие жилета и знака аварийной остановки', priority: 3 },
          { text: 'Уточнить тип топлива (Дизель/Бензин)', priority: 5 },
        ],
      },
    ],
  },
  {
    id: 'arrival-routine',
    name: 'Прибытие в новую страну',
    description: 'Первые действия в аэропорту или на вокзале.',
    icon: 'mdi:airplane-landing',
    tab: 'in-trip',
    groups: [
      {
        name: 'Связь и деньги',
        icon: 'mdi:access-point-network',
        items: [
          { text: 'Купить местную SIM-карту / eSim', priority: 5 },
          { text: 'Обменять немного валюты на первое время', priority: 4 },
          { text: 'Снять наличные в банкомате', priority: 4 },
        ],
      },
      {
        name: 'Транспорт',
        icon: 'mdi:taxi',
        items: [
          { text: 'Купить проездной билет', priority: 3 },
          { text: 'Скачать локальное приложение такси', priority: 4 },
          { text: 'Построить маршрут до отеля', priority: 5 },
        ],
      },
    ],
  },
]

export { HARDCODED_PRESETS }
