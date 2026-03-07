import { MOCK_USER_ID_1, MOCK_USER_ID_2 } from './00.users'

const POST_ID_1 = '3322b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b6c'
const POST_ID_2 = '4422b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b6d'

const EL_ID_1_TEXT = '5522b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b60'
const EL_ID_1_GALLERY = '5522b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b61'
const EL_ID_1_LOCATION = '5522b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b62'

const EL_ID_2_INTRO = 'b1b2c3d4-e5f6-4890-a234-567890abcde0'
const EL_ID_2_WATERFALLS = 'b1b2c3d4-e5f6-4890-a234-567890abcde1'
const EL_ID_2_BEACH = 'b1b2c3d4-e5f6-4890-a234-567890abcde2'
const EL_ID_2_LAGOON = 'b1b2c3d4-e5f6-4890-a234-567890abcde3'

const MEDIA_ID_1 = '7722b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b60'
const MEDIA_ID_2 = '7722b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b61'
const MEDIA_ID_3 = 'c1b2c3d4-e5f6-4a8b-9234-567890abcde0'
const MEDIA_ID_4 = 'c1b2c3d4-e5f6-4a8b-a234-567890abcde1'
const MEDIA_ID_5 = 'c1b2c3d4-e5f6-4a8b-b234-567890abcde2'
const MEDIA_ID_6 = 'c1b2c3d4-e5f6-4a8b-8234-567890abcde3'
const MEDIA_ID_7 = 'c1b2c3d4-e5f6-4a8b-9abc-567890abcde4'

export const MOCK_POST_DATA = [
  {
    id: POST_ID_1,
    userId: MOCK_USER_ID_1,
    title: 'Магия Киото: Осенний сезон',
    insight: 'Лучшее время для посещения — середина ноября, когда клены становятся ярко-красными.',
    description: 'Небольшой отчет о нашей поездке в древнюю столицу Японии. Храмы, еда и невероятные краски осени.',
    country: 'Япония',
    tags: ['travel', 'japan', 'kyoto', 'autumn', 'photography'],
    status: 'completed' as const,
    viewsCount: 1250,
    likesCount: 340,
    savesCount: 152,
    createdAt: new Date('2024-11-20T10:00:00Z'),
    updatedAt: new Date('2024-11-20T12:00:00Z'),
    latitude: 35.0116,
    longitude: 135.7681,
    statsDetail: {
      views: 1250,
      budget: '¥150,000',
      duration: '5 дней',
    },
    elements: [
      {
        id: EL_ID_1_TEXT,
        postId: POST_ID_1,
        order: 0,
        title: 'Вступление',
        content: [
          {
            id: 'block-1',
            type: 'markdown',
            text: 'Киото встречает тишиной, даже несмотря на толпы туристов. **Золотой павильон (Кинкаку-дзи)** особенно прекрасен на закате, когда золото крыши отражается в пруду.',
          },
        ],
        createdAt: new Date('2024-11-20T10:00:00Z'),
        updatedAt: new Date('2024-11-20T10:00:00Z'),
      },
      {
        id: EL_ID_1_GALLERY,
        postId: POST_ID_1,
        order: 1,
        title: 'Краски осени',
        content: [
          {
            id: 'block-2',
            type: 'gallery',
            displayType: 'grid',
            imageIds: [MEDIA_ID_1, MEDIA_ID_2],
          },
          {
            id: 'block-3',
            type: 'markdown',
            text: 'На фотографиях выше — виды из сада при храме Тэнрю-дзи.',
          },
        ],
        createdAt: new Date('2024-11-20T10:05:00Z'),
        updatedAt: new Date('2024-11-20T10:05:00Z'),
      },
      {
        id: EL_ID_1_LOCATION,
        postId: POST_ID_1,
        order: 2,
        title: 'Где это находится',
        content: [
          {
            id: 'block-4',
            type: 'location',
            location: {
              lat: 35.0394,
              lng: 135.7292,
              label: 'Kinkaku-ji',
              address: '1 Kinkakujicho, Kita Ward, Kyoto',
              color: '#FFD700',
            },
          },
        ],
        createdAt: new Date('2024-11-20T10:10:00Z'),
        updatedAt: new Date('2024-11-20T10:10:00Z'),
      },
    ],
    media: [
      {
        id: MEDIA_ID_1,
        postId: POST_ID_1,
        originalName: 'kinkakuji_fall.jpg',
        url: 'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?q=80&w=2574&auto=format&fit=crop',
        type: 'image' as const,
        sizeBytes: 123456,
        order: 0,
        createdAt: new Date('2024-11-20T09:55:00Z'),
        takenAt: null,
        latitude: null,
        longitude: null,
        width: 1920,
        height: 1080,
        variants: null,
        metadata: { caption: 'Золотой павильон' },
      },
      {
        id: MEDIA_ID_2,
        postId: POST_ID_1,
        originalName: 'kyoto_leaves.jpg',
        url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2670&auto=format&fit=crop',
        type: 'image' as const,
        sizeBytes: 234567,
        order: 1,
        createdAt: new Date('2024-11-20T09:56:00Z'),
        takenAt: null,
        latitude: null,
        longitude: null,
        width: 1920,
        height: 1280,
        variants: null,
        metadata: { caption: 'Красные клены' },
      },
    ],
  },

  {
    id: POST_ID_2,
    userId: MOCK_USER_ID_2,
    title: 'Ледяное сердце Исландии: Южное побережье',
    insight: 'Погода меняется каждые 15 минут. Берите многослойную одежду и непромокаемый верх — это не шутка!',
    description: '7-дневное путешествие на машине по знаменитому южному побережью Исландии: водопады, ледники, черные пляжи и вулканы.',
    country: 'Исландия',
    tags: ['iceland', 'roadtrip', 'nature', 'waterfalls', 'glacier'],
    status: 'completed' as const,
    viewsCount: 2800,
    likesCount: 890,
    savesCount: 420,
    createdAt: new Date('2025-08-15T18:00:00Z'),
    updatedAt: new Date('2025-08-16T11:00:00Z'),
    latitude: 63.5321,
    longitude: -19.019,
    statsDetail: {
      views: 2800,
      budget: '€2,500',
      duration: '7 дней',
    },
    elements: [
      {
        id: EL_ID_2_INTRO,
        postId: POST_ID_2,
        order: 0,
        title: 'Дорога огня и льда',
        content: [
          {
            id: 'block-is1',
            type: 'markdown',
            text: 'Южное побережье Исландии — это концентрат невероятных пейзажей. Прямо с кольцевой дороги открываются виды, от которых захватывает дух. Наш маршрут начинался в Рейкьявике и пролегал до знаменитой ледниковой лагуны Йокульсарлон.',
          },
        ],
        createdAt: new Date('2025-08-15T18:00:00Z'),
        updatedAt: new Date('2025-08-15T18:00:00Z'),
      },
      {
        id: EL_ID_2_WATERFALLS,
        postId: POST_ID_2,
        order: 1,
        title: 'Могучие водопады: Сельяландсфосс и Скогафосс',
        content: [
          {
            id: 'block-is2',
            type: 'markdown',
            text: 'Первые большие остановки — водопады **Сельяландсфосс**, за которым можно пройти, и **Скогафосс**, к вершине которого ведет длинная лестница. Готовьтесь промокнуть!',
          },
          {
            id: 'block-is3',
            type: 'gallery',
            displayType: 'carousel',
            imageIds: [MEDIA_ID_3, MEDIA_ID_4],
          },
        ],
        createdAt: new Date('2025-08-15T18:05:00Z'),
        updatedAt: new Date('2025-08-15T18:05:00Z'),
      },
      {
        id: EL_ID_2_BEACH,
        postId: POST_ID_2,
        order: 2,
        title: 'Пляж Рейнисфьяра',
        content: [
          {
            id: 'block-is4',
            type: 'location',
            location: {
              lat: 63.4043,
              lng: -19.0435,
              label: 'Reynisfjara Beach',
              address: 'Reynishverfisvegur, 871 Vík',
            },
          },
          {
            id: 'block-is5',
            type: 'markdown',
            text: 'Знаменитый пляж с черным вулканическим песком и базальтовыми колоннами. *Осторожно:* волны здесь непредсказуемы и очень опасны, не подходите близко к воде.',
          },
          {
            id: 'block-is6',
            type: 'image',
            imageId: MEDIA_ID_5,
            viewMode: 'full-width',
            caption: 'Базальтовые скалы "Пальцы тролля"',
          },
        ],
        createdAt: new Date('2025-08-15T18:10:00Z'),
        updatedAt: new Date('2025-08-15T18:10:00Z'),
      },
      {
        id: EL_ID_2_LAGOON,
        postId: POST_ID_2,
        order: 3,
        title: 'Ледниковая лагуна Йокульсарлон',
        content: [
          {
            id: 'block-is7',
            type: 'markdown',
            text: 'Жемчужина маршрута. Огромные айсберги откалываются от ледника и дрейфуют в сторону океана. Рядом находится "Бриллиантовый пляж", где льдины выбрасывает на черный песок.',
          },
          {
            id: 'block-is8',
            type: 'gallery',
            displayType: 'grid',
            imageIds: [MEDIA_ID_6, MEDIA_ID_7],
          },
        ],
        createdAt: new Date('2025-08-15T18:15:00Z'),
        updatedAt: new Date('2025-08-15T18:15:00Z'),
      },
    ],
    media: [
      {
        id: MEDIA_ID_3,
        postId: POST_ID_2,
        originalName: 'seljalandsfoss.jpg',
        url: 'https://images.unsplash.com/photo-1547702311-6050450546a3?q=80&w=2574&auto=format&fit=crop',
        type: 'image' as const,
        sizeBytes: 345678,
        order: 0,
        createdAt: new Date('2025-08-15T17:55:00Z'),
        takenAt: null,
        latitude: null,
        longitude: null,
        width: 1920,
        height: 1080,
        variants: null,
        metadata: {},
      },
      {
        id: MEDIA_ID_4,
        postId: POST_ID_2,
        originalName: 'skogafoss.jpg',
        url: 'https://images.unsplash.com/photo-1535546204-4849185d3457?q=80&w=2574&auto=format&fit=crop',
        type: 'image' as const,
        sizeBytes: 456789,
        order: 1,
        createdAt: new Date('2025-08-15T17:56:00Z'),
        takenAt: null,
        latitude: null,
        longitude: null,
        width: 1920,
        height: 1080,
        variants: null,
        metadata: {},
      },
      {
        id: MEDIA_ID_5,
        postId: POST_ID_2,
        originalName: 'reynisfjara.jpg',
        url: 'https://images.unsplash.com/photo-1563807396039-6ce1405b635f?q=80&w=2574&auto=format&fit=crop',
        type: 'image' as const,
        sizeBytes: 567890,
        order: 2,
        createdAt: new Date('2025-08-15T17:57:00Z'),
        takenAt: null,
        latitude: null,
        longitude: null,
        width: 1920,
        height: 1080,
        variants: null,
        metadata: {},
      },
      {
        id: MEDIA_ID_6,
        postId: POST_ID_2,
        originalName: 'jokulsarlon.jpg',
        url: 'https://images.unsplash.com/photo-1517411262332-9c989355433a?q=80&w=2574&auto=format&fit=crop',
        type: 'image' as const,
        sizeBytes: 678901,
        order: 3,
        createdAt: new Date('2025-08-15T17:58:00Z'),
        takenAt: null,
        latitude: null,
        longitude: null,
        width: 1920,
        height: 1080,
        variants: null,
        metadata: {},
      },
      {
        id: MEDIA_ID_7,
        postId: POST_ID_2,
        originalName: 'diamond-beach.jpg',
        url: 'https://images.unsplash.com/photo-1614082242135-e00b8c6274f8?q=80&w=2574&auto=format&fit=crop',
        type: 'image' as const,
        sizeBytes: 789012,
        order: 4,
        createdAt: new Date('2025-08-15T17:59:00Z'),
        takenAt: null,
        latitude: null,
        longitude: null,
        width: 1920,
        height: 1080,
        variants: null,
        metadata: {},
      },
    ],
  },
]
