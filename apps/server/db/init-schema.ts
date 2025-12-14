/* eslint-disable no-console */
import { db } from '../src/db'

export async function initSchema() {
  console.log('🏗️  Применение схемы базы данных...')

  const queries = `
    -- 1. Таблица Пользователей
    DEFINE TABLE users SCHEMALESS;
    DEFINE FIELD email ON TABLE users TYPE string ASSERT string::is::email($value);
    DEFINE INDEX email_unique ON TABLE users COLUMNS email UNIQUE;
    DEFINE FIELD createdAt ON TABLE users TYPE datetime DEFAULT time::now();

    -- 2. Таблица Путешествий
    DEFINE TABLE trips SCHEMALESS;
    DEFINE FIELD userId ON TABLE trips TYPE record<users>;
    DEFINE INDEX trip_owner ON TABLE trips COLUMNS userId;

    -- 3. Графовые связи (Участники)
    -- Гарантируем, что связь идет только от юзера к поездке
    DEFINE TABLE participates_in SCHEMALESS TYPE RELATION IN users OUT trips;
    DEFINE INDEX unique_participation ON TABLE participates_in COLUMNS in, out UNIQUE;

    -- 4. Графовые связи (Сохраненное)
    DEFINE TABLE saved SCHEMALESS TYPE RELATION IN users OUT posts;

    -- 5. Посты
    DEFINE TABLE posts SCHEMALESS;
    DEFINE FIELD userId ON TABLE posts TYPE record<users>;
    DEFINE INDEX post_author ON TABLE posts COLUMNS userId;

    -- 6. Дни и Активности (для быстрого поиска по родителю)
    DEFINE INDEX day_trip ON TABLE days COLUMNS tripId;
    DEFINE INDEX activity_day ON TABLE activities COLUMNS dayId;
    
    -- 7. Справочники
    DEFINE TABLE metro_systems SCHEMALESS;
    DEFINE TABLE llm_models SCHEMALESS;
  `

  await db.query(queries)
  console.log('✅ Схема успешно применена.')
}
