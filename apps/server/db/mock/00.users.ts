/**
  Константа с ID мокового пользователя для легкого доступа
  из других файлов моковых данных.
 */
export const MOCK_USER_ID_1 = '1a97d95a-0158-4171-8258-52c7a917e3f0'

/**
  Моковые данные для таблицы 'users'.
 */
export const MOCK_USER_DATA = [
  {
    id: MOCK_USER_ID_1,
    role: 'admin' as const,
    email: 'dev@dev.dev',
    emailVerified: new Date(),
    name: 'Иван',
    avatarUrl: '/avatars/ghoul.gif',
    password: '$argon2id$v=19$m=65536,t=2,p=1$9cSm+KIHJMY82nsu2L7IxA$SVFSIsvCOOwy5q5PIawXubwYbk+Q4jTiE5YeiWp8gKg',
  },
]
