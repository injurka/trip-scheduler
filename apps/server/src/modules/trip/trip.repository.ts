import type { z } from 'zod'
import type { CreateTripInputSchema, ListTripsInputSchema, UpdateTripInputSchema } from '~/modules/trip/trip.schemas'
import { v4 as uuidv4 } from 'uuid'
import { db } from '~/db' // Предполагаем, что здесь экспорт экземпляра Surreal
import { measureDbQuery } from '~/lib/db-monitoring'

// Хелпер для очистки ID от префикса (users:123 -> 123)
const cleanId = (id: string) => id.includes(':') ? id.split(':')[1] : id

// Хелпер для маппинга результата
function mapTrip(trip: any) {
  if (!trip)
    return null
  return {
    ...trip,
    id: cleanId(trip.id.toString()),
    participants: Array.isArray(trip.participants)
      ? trip.participants.map((p: any) => ({
        ...p,
        id: cleanId(p.id.toString()),
      }))
      : [],
    // Обработка дат, если Surreal возвращает строки
    startDate: new Date(trip.startDate),
    endDate: new Date(trip.endDate),
    createdAt: new Date(trip.createdAt),
    updatedAt: new Date(trip.updatedAt),
  }
}

export const tripRepository = {
  /**
   * Получает все путешествия с применением фильтров.
   */
  async getAll(filters?: z.infer<typeof ListTripsInputSchema>, userId?: string) {
    return measureDbQuery('trips', 'select', async () => {
      let query = `
        SELECT 
          *,
          (
            SELECT id, name, avatarUrl 
            FROM <-participates_in.in
          ) as participants
        FROM trips 
        WHERE 1=1
      `
      const params: Record<string, any> = {}

      if (filters?.tab === 'public') {
        query += ` AND visibility = 'public'`
      }
      else if (filters?.tab === 'my' && userId) {
        // Ищем трипы, где пользователь является участником (in -> participates_in -> out)
        // Но так как мы идем от trips, то ищем входящие ребра от конкретного юзера
        query += ` AND <-participates_in[WHERE in = type::thing('users', $currentUserId)]`
        params.currentUserId = userId
      }

      if (filters?.search) {
        query += ` AND (title ~ $search OR description ~ $search)`
        params.search = filters.search
      }

      if (filters?.statuses && filters.statuses.length > 0) {
        query += ` AND status IN $statuses`
        params.statuses = filters.statuses
      }

      if (filters?.tags && filters.tags.length > 0) {
        // Проверяем, содержит ли массив tags в базе хотя бы один тег из фильтра
        query += ` AND array::any(tags, $tags)`
        params.tags = filters.tags
      }

      if (filters?.cities && filters.cities.length > 0) {
        query += ` AND array::any(cities, $cities)`
        params.cities = filters.cities
      }

      if (filters?.userIds && filters.userIds.length > 0) {
        // Трипы, в которых участвуют заданные юзеры
        // Используем подзапрос: count входящих связей от этих юзеров > 0
        query += ` AND count(<-participates_in[WHERE in.id IN type::thing('users', $filterUserIds)]) > 0`
        params.filterUserIds = filters.userIds
      }

      query += ` ORDER BY createdAt DESC`

      const [result] = await db.query<[any[]]>(query, params)
      return (result || []).map(mapTrip)
    })
  },

  /**
   * Получает список уникальных городов из всех путешествий.
   */
  async getUniqueCities() {
    return measureDbQuery('trips', 'select', async () => {
      const [result] = await db.query<[{ cities: string[][] }[]]>(`
        SELECT ARRAY::DISTINCT(cities) as cities 
        FROM trips 
        GROUP ALL
      `)

      const nestedCities = result?.[0]?.cities || []

      return [...new Set(nestedCities.flat())]
    })
  },

  /**
   * Получает список уникальных тегов, опционально фильтруя по поисковому запросу.
   */
  async getUniqueTags(searchQuery?: string) {
    return measureDbQuery('trips', 'select', async () => {
      // Базовое выражение:
      // 1. Берем только значения поля tags со всех строк (получаем [[tag1, tag2], [tag3]])
      // 2. Делаем плоским (flat)
      // 3. Убираем дубли (distinct)
      let expression = `array::distinct(array::flatten((SELECT value tags FROM trips)))`

      // Если есть поиск, фильтруем массив "на лету" используя синтаксис [WHERE ...]
      // $this ссылается на текущий элемент массива (строку тега)
      if (searchQuery) {
        expression += `[WHERE $this ~ $search]`
      }

      // Оборачиваем в SELECT, чтобы получить объект { tags: [...] }
      // array::slice берет первые 20 элементов
      const query = `SELECT array::slice(${expression}, 0, 20) as tags`

      // Выполняем запрос
      const [result] = await db.query<[{ tags: string[] }[]]>(query, {
        search: searchQuery,
      })

      console.log('result', result)

      // result - это массив строк ответа. Нам нужна первая строка и её поле tags.
      return result?.[0]?.tags || []
    })
  },

  /**
   * Получает путешествие по ID.
   */
  async getById(id: string) {
    return measureDbQuery('trips', 'select', async () => {
      const [result] = await db.query<[any[]]>(`
        SELECT 
          *,
          (
            SELECT id, name, avatarUrl 
            FROM <-participates_in.in
          ) as participants,
          (
            SELECT * FROM trip_sections 
            WHERE tripId = $parent.id 
            ORDER BY order ASC
          ) as sections
        FROM trips 
        WHERE id = type::thing('trips', $id)
      `, { id })

      const trip = result?.[0]
      if (!trip)
        return null

      const mapped = mapTrip(trip)
      // Маппим секции, так как mapTrip их не трогает
      if (mapped && trip.sections) {
        mapped.sections = trip.sections.map((s: any) => ({
          ...s,
          id: cleanId(s.id.toString()),
          tripId: cleanId(s.tripId.toString()),
        }))
      }
      return mapped
    })
  },

  /**
   * Получает путешествие со всеми прикрепленными изображениями (для квот).
   * В SurrealDB пока нет отдельной таблицы images в схеме, предположим,
   * что это поле или отдельная таблица. Если images нет в схеме,
   * оставим заглушку или простейшую выборку.
   */
  async getByIdWithImages(id: string) {
    return measureDbQuery('trips', 'select', async () => {
      // Предполагаем, что images хранятся внутри или связаны
      // Если images - это массив объектов внутри трипа:
      const [result] = await db.query<[any[]]>(`
        SELECT *, images FROM trips WHERE id = type::thing('trips', $id)
      `, { id })

      const trip = result?.[0]
      if (!trip)
        return null

      // Возвращаем в сыром виде для сервиса
      return {
        ...trip,
        id: cleanId(trip.id.toString()),
        userId: cleanId(trip.userId.toString()),
        images: trip.images || [],
      }
    })
  },

  /**
   * Получает путешествие со всеми днями и активностями.
   */
  async getByIdWithDays(id: string) {
    return measureDbQuery('trips', 'select', async () => {
      const [result] = await db.query<[any[]]>(`
        SELECT 
          *,
          (
            SELECT id, name, avatarUrl 
            FROM <-participates_in.in
          ) as participants,
          (
            SELECT * FROM trip_sections 
            WHERE tripId = $parent.id 
            ORDER BY order ASC
          ) as sections,
          (
            SELECT 
              *,
              id,
              (
                SELECT *, id FROM activities 
                WHERE dayId = $parent.id 
                ORDER BY startTime ASC
              ) as activities
            FROM days 
            WHERE tripId = $parent.id 
            ORDER BY date ASC
          ) as days
        FROM trips 
        WHERE id = type::thing('trips', $id)
      `, { id })

      const trip = result?.[0]
      if (!trip)
        return null

      const mapped = mapTrip(trip)

      // Дополнительный маппинг для дней и секций
      if (mapped) {
        mapped.sections = (trip.sections || []).map((s: any) => ({
          ...s,
          id: cleanId(s.id.toString()),
        }))
        mapped.days = (trip.days || []).map((d: any) => ({
          ...d,
          id: cleanId(d.id.toString()),
          date: new Date(d.date),
          activities: (d.activities || []).map((a: any) => ({
            ...a,
            id: cleanId(a.id.toString()),
          })),
        }))
      }
      return mapped
    })
  },

  /**
   * Создает новое путешествие.
   */
  async create(data: z.infer<typeof CreateTripInputSchema>, userId: string) {
    return measureDbQuery('trips', 'insert', async () => {
      const { startDate, endDate, ...restData } = data
      const tripId = uuidv4()

      const newStartDate = (startDate ? new Date(startDate) : new Date()).toISOString()
      const newEndDate = (endDate ? new Date(endDate) : new Date(newStartDate)).toISOString()

      // Используем транзакцию для создания трипа и связи
      const query = `
        BEGIN TRANSACTION;

        LET $trip = (CREATE trips CONTENT {
          id: type::thing('trips', $tripId),
          userId: type::thing('users', $userId),
          title: $title,
          description: $description,
          startDate: $startDate,
          endDate: $endDate,
          status: 'draft',
          visibility: 'private',
          cities: [],
          tags: [],
          createdAt: time::now(),
          updatedAt: time::now()
        });

        RELATE type::thing('users', $userId)->participates_in->$trip SET joined_at = time::now();

        RETURN $trip;

        COMMIT TRANSACTION;
      `

      const [results] = await db.query<[any[]]>(query, {
        tripId,
        userId,
        title: restData.title,
        description: restData.description || null,
        startDate: newStartDate,
        endDate: newEndDate,
      })

      // results вернет массив, где последний элемент результат RETURN $trip (или массив результатов операций)
      // В SurrealDB JS, если транзакция успешна, мы получаем результаты по порядку или последний.
      // Обычно CREATE возвращает массив из одной записи.
      const createdTrip = results?.[0] // Зависит от версии SDK, иногда нужно results[results.length - 1]

      // Чтобы быть уверенным, сделаем выборку как в Drizzle (getById) или просто вернем то что создали
      if (!createdTrip)
        return null

      return {
        ...mapTrip(createdTrip),
        participants: [{ id: userId }], // Мы знаем, что создатель - участник
      }
    })
  },

  /**
   * Обновляет детали путешествия.
   */
  async update(id: string, details: z.infer<typeof UpdateTripInputSchema>['details']) {
    return measureDbQuery('trips', 'update', async () => {
      const { startDate, endDate, participantIds, ...restDetails } = details

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        ...restDetails,
      }
      if (startDate)
        updateData.startDate = new Date(startDate).toISOString()
      if (endDate)
        updateData.endDate = new Date(endDate).toISOString()

      // 1. Обновляем поля трипа
      let query = `
        UPDATE type::thing('trips', $id) MERGE $data;
      `

      // 2. Если переданы участники, обновляем связи
      // Это сложнее в графах. Удаляем старые связи, которых нет в списке, и создаем новые.
      if (participantIds) {
        query += `
          LET $trip = type::thing('trips', $id);
          LET $newParticipants = type::thing('users', $participantIds);
          
          -- Удаляем тех, кого нет в новом списке
          DELETE participates_in WHERE out = $trip AND in NOT IN $newParticipants;
          
          -- Добавляем новых (RELATE не дублирует если UNIQUE индекс есть, но лучше проверить)
          -- FOR $userId IN $newParticipants {
          --    RELATE $userId->participates_in->$trip SET joined_at = time::now() ON DUPLICATE KEY UPDATE joined_at = joined_at;
          -- };
          -- Более простой способ в Surreal:
          RELATE $newParticipants->participates_in->$trip SET joined_at = time::now();
        `
      }

      // Возвращаем обновленный трип
      query += `
        SELECT 
          *,
          (SELECT id, name, avatarUrl FROM <-participates_in.in) as participants,
          (SELECT * FROM trip_sections WHERE tripId = $parent.id ORDER BY order ASC) as sections
        FROM type::thing('trips', $id);
      `

      // Выполняем. Так как это несколько инструкций, используем query.
      // Последний SELECT вернет данные.
      const results = await db.query<any[]>(query, {
        id,
        data: updateData,
        participantIds: participantIds || [],
      })

      // Берем результат последнего запроса
      const updatedTrip = results[results.length - 1]?.[0]
      return mapTrip(updatedTrip)
    })
  },

  /**
   * Удаляет путешествие по ID.
   */
  async delete(id: string) {
    return measureDbQuery('trips', 'delete', async () => {
      // Каскадное удаление в SurrealDB не всегда автоматическое для графов,
      // но если удалить вершину, ребра (participates_in) удалятся автоматически.
      // Связанные таблицы (days, sections) нужно удалить вручную или иметь события.

      const query = `
        BEGIN TRANSACTION;
        DELETE FROM trip_sections WHERE tripId = type::thing('trips', $id);
        DELETE FROM days WHERE tripId = type::thing('trips', $id); 
        -- (activities удалятся если есть логика, но пока оставим простым удалением дней)
        DELETE type::thing('trips', $id) RETURN BEFORE;
        COMMIT TRANSACTION;
      `

      const results = await db.query<[any[]]>(query, { id })
      // Находим результат DELETE
      // results будет содержать массивы для каждого шага.
      // DELETE ... RETURN BEFORE вернет удаленный объект
      const deletedItem = results.find((r: any) => r && r[0] && r[0].id && r[0].title)?.[0]

      return deletedItem ? mapTrip(deletedItem) : null
    })
  },

  /**
   * Получает последние N путешествий пользователя.
   */
  async listByUser(userId: string, limit: number) {
    return measureDbQuery('trips', 'select', async () => {
      // Найти трипы, где юзер участвует И видимость public
      const query = `
        SELECT 
          *,
          (SELECT id, name, avatarUrl FROM <-participates_in.in) as participants
        FROM trips
        WHERE 
          visibility = 'public' 
          AND <-participates_in[WHERE in = type::thing('users', $userId)]
        ORDER BY createdAt DESC
        LIMIT $limit
      `

      const [results] = await db.query<[any[]]>(query, { userId, limit })
      return (results || []).map(mapTrip)
    })
  },
}
