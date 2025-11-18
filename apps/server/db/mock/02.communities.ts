import { MOCK_USER_ID_1, MOCK_USER_ID_2, MOCK_USER_ID_3 } from './00.users'

const getCommunityAssetPath = (filename: string) => `/static/images/communities/${filename}`

const COMMUNITY_ASIA_ID = 'c1a2b3c4-d5e6-f7a8-9b0c-1d2e3f4a5b6c'
const COMMUNITY_FAMILY_ID = 'd2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7'
const COMMUNITY_BUDGET_ID = 'e3c4d5e6-f7a8-b9c0-d1e2-f3a4b5c6d7e8'

export const MOCK_COMMUNITIES_DATA = [
  {
    id: COMMUNITY_ASIA_ID,
    name: 'Путешествия по Азии',
    description: 'Обсуждаем маршруты, делимся советами и фотографиями из поездок по странам Азии. От Таиланда до Японии!',
    coverImageUrl: getCommunityAssetPath('asia-cover.jpg'),
    avatarUrl: getCommunityAssetPath('asia-avatar.jpg'),
    privacyType: 'public' as const,
    ownerId: MOCK_USER_ID_1,
  },
  {
    id: COMMUNITY_FAMILY_ID,
    name: 'Семейные поездки',
    description: 'Закрытое сообщество для планирования и обсуждения путешествий с детьми. Безопасность, комфорт и развлечения.',
    coverImageUrl: getCommunityAssetPath('family-cover.jpg'),
    avatarUrl: getCommunityAssetPath('family-avatar.jpg'),
    privacyType: 'private' as const,
    ownerId: MOCK_USER_ID_2,
  },
  {
    id: COMMUNITY_BUDGET_ID,
    name: 'Бюджетный бэкпэкинг',
    description: 'Как посмотреть мир с минимальными затратами. Лайфхаки, хостелы, дешевые билеты и бесплатные достопримечательности.',
    coverImageUrl: getCommunityAssetPath('budget-cover.jpg'),
    avatarUrl: getCommunityAssetPath('budget-avatar.jpg'),
    privacyType: 'public' as const,
    ownerId: MOCK_USER_ID_3,
  },
]

export const MOCK_COMMUNITY_MEMBERS_DATA = [
  // Участники "Путешествия по Азии"
  { communityId: COMMUNITY_ASIA_ID, userId: MOCK_USER_ID_1, role: 'admin' as const },
  { communityId: COMMUNITY_ASIA_ID, userId: MOCK_USER_ID_2, role: 'member' as const },
  { communityId: COMMUNITY_ASIA_ID, userId: MOCK_USER_ID_3, role: 'moderator' as const },

  // Участники "Семейные поездки"
  { communityId: COMMUNITY_FAMILY_ID, userId: MOCK_USER_ID_2, role: 'admin' as const },
  { communityId: COMMUNITY_FAMILY_ID, userId: MOCK_USER_ID_1, role: 'member' as const },

  // Участники "Бюджетный бэкпэкинг"
  { communityId: COMMUNITY_BUDGET_ID, userId: MOCK_USER_ID_3, role: 'admin' as const },
  { communityId: COMMUNITY_BUDGET_ID, userId: MOCK_USER_ID_1, role: 'member' as const },
]
