/**
  Константа с ID мокового пользователя для легкого доступа
  из других файлов моковых данных.
 */
export const MOCK_USER_ID_1 = '1a97d95a-0158-4171-8258-52c7a917e3f0'
export const MOCK_USER_ID_2 = '1a97d95a-0158-4171-8258-52c7a917e3f2'
export const MOCK_USER_ID_3 = '1a97d95a-0158-4171-8258-52c7a917e3f3'

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
    password: '$argon2id$v=19$m=65536,t=2,p=1$5dk/3wyofRTLJmAMfC1LD5c92Ci4fGkqYkEUBOTfWy8$TBGnUdaGFaHKevxIvvIg8FgdPSl1F4h5b5Zo73rOn3M',
  },
  {
    id: MOCK_USER_ID_2,
    role: 'admin' as const,
    email: 'dev2@dev.dev',
    emailVerified: new Date(),
    name: 'Артем',
    avatarUrl: '/avatars/magic-girl.png',
    password: '$argon2id$v=19$m=65536,t=2,p=1$5dk/3wyofRTLJmAMfC1LD5c92Ci4fGkqYkEUBOTfWy8$TBGnUdaGFaHKevxIvvIg8FgdPSl1F4h5b5Zo73rOn3M',
  },
  {
    id: MOCK_USER_ID_3,
    role: 'admin' as const,
    email: 'dev3@dev.dev',
    emailVerified: new Date(),
    name: 'Максим',
    avatarUrl: '/avatars/maxim.png',
    password: '$argon2id$v=19$m=65536,t=2,p=1$5dk/3wyofRTLJmAMfC1LD5c92Ci4fGkqYkEUBOTfWy8$TBGnUdaGFaHKevxIvvIg8FgdPSl1F4h5b5Zo73rOn3M',
  },
]
