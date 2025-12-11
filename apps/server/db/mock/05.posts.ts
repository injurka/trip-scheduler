import { MOCK_USER_ID_1, MOCK_USER_ID_2 } from './00.users'

// Валидные UUID для постов
const POST_ID_1 = '3322b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b6c'
const POST_ID_2 = '4422b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b6d'

// Валидные UUID для элементов
const EL_ID_1_TEXT = '5522b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b60'
const EL_ID_1_GALLERY = '5522b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b61'
const EL_ID_1_LOCATION = '5522b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b62'

const EL_ID_2_MAIN = '6622b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b60'

// Валидные UUID для медиа
const MEDIA_ID_1 = '7722b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b60'
const MEDIA_ID_2 = '7722b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b61'
const MEDIA_ID_3 = '8822b3c4-d5e6-4f8a-9b0c-1d2e3f4a5b60'

export const MOCK_POST_DATA = [
  // --- ПОСТ 1: Путешествие в Японию ---
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
    createdAt: new Date('2024-11-20T10:00:00Z'),

    // Элементы поста (Секции)
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
            imageIds: [MEDIA_ID_1, MEDIA_ID_2], // Ссылаемся на ID медиа-файлов ниже
          },
          {
            id: 'block-3',
            type: 'markdown',
            text: 'На фотографиях выше — виды из сада при храме Тэнрю-дзи.',
          },
        ],
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
      },
    ],

    // Медиа файлы, связанные с постом
    media: [
      {
        id: MEDIA_ID_1,
        postId: POST_ID_1,
        elementId: EL_ID_1_GALLERY, // Привязан к секции галереи
        originalName: 'kinkakuji_fall.jpg',
        url: 'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?q=80&w=2574&auto=format&fit=crop',
        type: 'image' as const,
        width: 1920,
        height: 1080,
        metadata: { caption: 'Золотой павильон' },
      },
      {
        id: MEDIA_ID_2,
        postId: POST_ID_1,
        elementId: EL_ID_1_GALLERY,
        originalName: 'kyoto_leaves.jpg',
        url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2670&auto=format&fit=crop',
        type: 'image' as const,
        width: 1920,
        height: 1280,
        metadata: { caption: 'Красные клены' },
      },
    ],
  },

  // --- ПОСТ 2: Обзор кофейни ---
  {
    id: POST_ID_2,
    userId: MOCK_USER_ID_2,
    title: 'Скрытый жемчуг Берлина: Bonanza Coffee',
    insight: 'Обязательно попробуйте их фильтр-кофе, они сами обжаривают зерна на заднем дворе.',
    description: null,
    country: 'Германия',
    tags: ['coffee', 'berlin', 'guide', 'food'],
    status: 'draft' as const, // Черновик
    viewsCount: 0,
    likesCount: 0,
    createdAt: new Date('2024-12-01T09:30:00Z'),

    elements: [
      {
        id: EL_ID_2_MAIN,
        postId: POST_ID_2,
        order: 0,
        title: null,
        content: [
          {
            id: 'block-b1',
            type: 'image',
            imageId: MEDIA_ID_3,
            viewMode: 'full-width',
            caption: 'Интерьер кофейни',
          },
          {
            id: 'block-b2',
            type: 'markdown',
            text: 'Находится во внутреннем дворе в Кройцберге. Очень минималистично, много света и зелени. Идеальное место для работы с ноутбуком утром.',
          },
          {
            id: 'block-b3',
            type: 'location',
            location: {
              lat: 52.4988,
              lng: 13.4183,
              label: 'Bonanza Coffee Roasters',
              address: 'Adalbertstraße 70, 10999 Berlin',
            },
          },
        ],
      },
    ],

    media: [
      {
        id: MEDIA_ID_3,
        postId: POST_ID_2,
        elementId: EL_ID_2_MAIN,
        originalName: 'bonanza_coffee.jpg',
        url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2547&auto=format&fit=crop',
        type: 'image' as const,
        width: 1080,
        height: 1080,
      },
    ],
  },
]
