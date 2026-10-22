# Задания для LLM-агентов

Этот документ передаётся вместе с [планом](implementation-plan.md) и [исследованием](research.md). Он предназначен для будущей реализации. Исследовательский запуск не выполнял эти задания.

## Общие правила исполнителей

1. Прочитать актуальные AGENTS.md и skills соответствующих областей. Сверить реальные пути и package scripts с checkout; сведения исследования датированы 2026-10-22.
2. Оркестратор фиксирует исходный `git status`, владельцев файлов и scope. Уже существующие dirty-изменения сохранять. На старте исследования `tools/metro-import/` и части frontend имели посторонние изменения, позднее вошедшие в другие коммиты. Это не часть city-catalog; перед работой снова проверить состояние, не откатывать их.
3. Передавать агенту **одно задание** и необходимые уже утверждённые контракты. Разрешена работа только в назначенных файлах; правка общего файла — через владельца, с конкретным patch request.
4. Общее schema.ts, Drizzle journal/snapshots, root package/lock, router registry и shared type interfaces имеют одного владельца в каждый момент. Две задачи не генерируют миграции параллельно.
5. Один интегратор выполняет `bun install`/обновление lockfile при необходимости и полные форматтеры. Агенты не исправляют попутно ошибки в чужом change set.
6. Сначала закончить локальный, reviewable результат. Production apply, destructive restore, commit, push, release и публикацию выполнять только при соответствующем пользовательском запросе; подготовка dry-run и runbook не требует остановки на согласование.
7. Не назначать внешние IDs по догадке. Не использовать LLM как географический resolver или переводчик базы. Не создавать фальшивые результаты внешнего API для прохождения проверок.
8. Полные дампы и персональные migration reports не добавлять в git; использовать анонимизированные fixtures и агрегаты.
9. Если локальная БД/браузер/устройство недоступны, продолжить независимую часть и точно отметить недоказанный критерий. Не подменять проверку runtime чтением исходника.
10. У каждой задачи есть отчёт `execution/A<N>.md`: сделанное, файлы, контрактные изменения, точные проверки/результаты, ограничения, что требуется следующей задаче.

## Зависимости и разрешённые волны

| Волна | Задачи | Когда стартуют |
| --- | --- | --- |
| 0 | A0 — фактический аудит и сверка контрактов | Сразу |
| 1 | A1 — общая схема/DTO | После A0; оперативные неизвестные, не блокирующие additive schema, фиксируются отдельно |
| 2 | A2 — импорт каталога; A5 — API-независимый picker и доменный adapter | После A1. A5 использует fixtures и контракт, без реального search до A3 |
| 3 | A3 — поиск и resolver | После A2 и заморозки DTO A1 |
| 4 | A4 — backend bindings/compatibility | После A3 |
| 5 | A6 — все формы; A7 — карты/погода; A8 — импорт/AI; A9 — offline/dumps | После A4 и A5. A6 интегрирует погодные поля формы через контракт A7; A7 не редактирует trip-edit-info-dialog |
| 6 | A10 — полный backfill CLI и локальная миграция | После A6–A9; read-only audit prototype из A0 можно готовить раньше |
| 7 | A11 — интеграция, проверки, подготовка включения | После A10; фактические production ворота остаются отдельными |

Волны — максимум допустимой параллельности, не требование запускать все задачи одновременно. При смене scope/владельца оркестратор обновляет таблицу. Изолированные worktrees возможны, но перенос результата и общий контракт должны быть согласованы; не терять незакоммиченные изменения при переключении checkout.

## A0. Аудит данных и всех путей ввода

**Цель:** получить реальный объём миграции и исключить пропущенные формы.

**Вход:** пакет плана, текущий checkout, разрешённый локальный dump/staging при наличии.

**Владение:** `plans/city-catalog/execution/A0.md`, read-only исследовательские утилиты в новой папке `tools/geo-migration/` (интерфейс согласовать до создания workspace). Не менять application schema и пользовательские записи.

**Задание агенту:**

> Проследи все ручные/машинные записи города: поездка create/edit, highlights, reviews во всех подключённых формах, flight segments, EXIF, AI document extraction, CLI/core Obsidian и server AI trip. Составь таблицу UI → mutation → service/repository → persistence → readers. На разрешённой локальной копии собери raw labels с entity/path/country/coords/количеством ссылок. Проверь существующие country IDs, native API version policy, реальный offline read/edit scope и формат дампа. Прогони candidate matching по pinned GeoNames без применения. Выдай агрегаты coverage/ambiguous/not_found/non-settlement и список недостающих контекстов. Если БД нет, используй fixtures для разработки, но не называй их пользовательским аудитом. Заверши reviewable отчётом и обновлением инвентаря.

**Приёмка:** каждый известный структурированный город имеет владельца и путь сохранения; missing forms перечислены; ни одной записи в целевую БД. Отдельно назвать старые native clients и вопросы, без которых strict cutover невозможен.

## A1. Каноническая схема и замороженные контракты

**Зависимость:** A0.

**Владение:** `apps/server/db/schema.ts`, миграции/journal/snapshots Drizzle, `db/schema.type.ts`, новые geo schemas, центральные client API interfaces/models. Единственный генератор миграций. Запросы последующих агентов на новые поля принимает интегратор.

**Задание агенту:**

> Реализуй additive схему из раздела 2 плана и sourceCode стран без замены существующих ID. Зафиксируй детерминированный UUIDv5 source identity, GeoPlaceRef, результаты resolver и error codes, cityIds write input, cityRefs/unresolvedCities read shape, weatherByPlaceId и сегментные ID. Укажи точные переходные инварианты legacy-полей. Используй существующий способ type inference через tRPC; importer не получает private runtime dependency. Подготовь миграции и точные позиции добавления новых DTO в API. Утверди один contract.md в execution, который все последующие задачи импортируют/соблюдают; не создавать конкурирующие названия полей.

**Приёмка:** миграция на чистую и существующую локальную БД; отклонение недопустимых CHECK/FK комбинаций; UUID стабилен после пересоздания; старое чтение ещё работает. Контракт `cityRefs` содержит position; unresolved entries имеют сохранённый label и position.

## A2. Воспроизводимый импорт каталога и замер ресурсов

**Зависимость:** A1.

**Владение:** новая `apps/server/db/geo-catalog/`, локальные fixtures и manifest/отчёт; центральные package scripts/lock добавляет интегратор.

**Задание агенту:**

> Сделай CLI import/update каталога с pinned manifest, SHA-256, allowlist, explicit country mapping, streaming alternateNamesV2 и ограниченным набором языков. Отдельно поддержи verified extra GeoNames IDs и app aliases с provenance. Частичная загрузка не публикуется. Повтор запуска не меняет идентичности. Отсутствие в новом subset и source deletion различай; referenced записи сохраняй. На локальном PostgreSQL 16 измерь places/names/index bytes, import peak RSS/time, временное место и RU preferred-name coverage. Сравни базовый import и aliases/indexes; приложи воспроизводимые команды. Если точные ресурсы превышают ожидания, оптимизируй поля/aliases и отчитайся, не скрывай рост.

**Приёмка:** повторный import, оборванный import, malformed record, unknown country и retired record обработаны. Все записи принятого набора либо загружены, либо находятся в явном reject report. Source country key не генерируется по индексу. Числа PostgreSQL реально измерены, ZIP/JSON не выданы за DB size.

## A3. Search API, строгий resolver и client repository

**Зависимость:** A2.

**Владение:** `apps/server/src/modules/geo/`, `repositories/geo.repository.ts`, новый client API repository, последовательное подключение в router/API registry. Центральные interfaces уже созданы A1; изменения только через согласованный handoff.

**Задание агенту:**

> Реализуй geo.search/getByIds и ограниченный batch resolver для legacy/import. Следуй контракту и ranking плана. Для короткого ввода обеспечь prefix index path; fuzzy результат остаётся кандидатом, не auto-resolve. Dedup результатов по place ID до limit, country/kind filtering, Unicode/aliases, ограничения запроса, bounded cache и request metrics. Не обращайся к публичному Nominatim и не выгружай весь каталог в API. getByIds должен гидратировать retired refs. Разрешение возвращает deterministic status/reason/candidates/provenance; неоднозначные совпадения остаются на проверке. Подключи db.geo через фактический `shared/services/api`.

**Приёмка:** контрактные и DB integration проверки из раздела 7; malicious wildcard literal input; одинаковые имена в стране; stable ordering; p95 с описанием стенда и EXPLAIN. Проверить PostgreSQL 16 pg_trgm availability; при ограничении прав сохранить корректный prefix fallback с явным отчётом.

## A4. Связи поездок/профиля и совместимый backend

**Зависимость:** A3.

**Владение:** backend trip/user/destination-review services, schemas/procedures и repositories; targeted booking validation в trip-section service/schema. Schema/migration запросы отправлять владельцу A1. После завершения передать погодные методы trip.service/procedures во владение A7, если ему нужно их менять.

**Задание агенту:**

> Реализуй cityIds/geoPlaceId writes, транзакции связи поездки и единую read-проекцию для list/byId/withDays/shareSlug/user-lists. Добавь refs/positions и unresolved entries, сохрани old string read fields. Обнови фильтры, facets и profile map-point payloads по ID; facets должны отражать доступные пользователю записи, а не весь мировой каталог. Проверь country/kind/retired, неизвестные IDs и duplicates. Legacy PATCH с неизменёнными городами сохраняет связи. Новая raw строка проходит resolver либо получает typed error; никакого silent create. На bookings content server path проверяй вложенные departureCityId/arrivalCityId, не доверяй z.any. Не принимай invented IDs от LLM extraction. Сохрани ACL существующих сущностей.

**Приёмка:** прямые mutations не обходят валидацию; mutation откатывается целиком при невалидном городе; title-only PATCH старой поездки работает; все read endpoints дают согласованные DTO. Два одноимённых города имеют разные ID, фильтры и legacy display keys.

## A5. Доменный picker и расширение UI kit

**Зависимость:** A1, затем интеграция с A3.

**Владение:** `01.kit/kit-select-with-search/`, новая `03.domain/geo-place-picker/`. Не менять формы фич A6, API registry A3 и shared models A1.

**Задание агенту:**

> Добавь в kit API-независимую поддержку controlled query/remote filtering и понятную гидратацию выбранных items. Сохрани поведение всех прежних локальных селектов. В domain компоненте реализуй db.geo, debounce/race guard, bounded selected refs, single/multiple selection, country/kinds, search states и legacy/retired rendering. Labels выбранных ID переживают смену страницы поиска и reload. API-вызовы/Pinia не помещай в 01.kit. Соблюдай слои и существующие компоненты/стили. Произвольный текст не создаёт item.

**Приёмка:** поздний ответ не перезаписывает новый поиск; выбранный label не превращается в UUID; смена страны не сохраняет несовместимый city; keyboard/touch/focus и overflow подтверждены браузером. Существующие selects стран, тегов и иных локальных списков работают как раньше.

## A6. Все пользовательские формы и ID-фильтры

**Зависимости:** A4, A5. Контракт weatherByPlaceId уже закреплён A1; при интеграции погоды согласоваться с A7.

**Владение:** trips-hub create/filter, trip-edit-info-dialog, account open-trips, highlights create/edit/composable, все активные destination-review forms/dialogs/composable, flight-card и их UI models. Query URL adapters по этим фичам. `trip-edit-info-dialog` принадлежит только A6, включая его weather preview.

**Задание агенту:**

> Замени все найденные в A0 ручные city inputs общим picker, включая оба поля каждого flight segment. Передавай canonical IDs. Совместимые отображаемые строки берутся из refs. Изменение заголовка старой поездки не отправляет пустой/неполный cityIds; unresolved chips требуют уточнения только при редактировании выбора. Выбор города задаёт согласованную страну в profile forms, сохраняет точные фото/отзыв/airport coords. Обнови reuse suggestions, копирование, EXIF suggestions, filters/facets и URL state. Ошибка/no results/offline различимы. Старые ссылки разбираются adapter без guessing. Не меняй поля адресов/станций на city picker.

**Приёмка:** выполнить UI-сценарии всех активных create/edit forms, смену страны, несколько сегментов и пересадку, оба одноимённых города в фильтрах, cold reload выбранных refs. Повторный поиск по label fields не обнаруживает оставшийся активный текстовый обход города. Согласовать изменения booking models с A8 importer transport.

## A7. Карты, погода, метро и отображение

**Зависимость:** A4; service files от A4 передаются явно. Работает параллельно A6/A8/A9 в своих файлах.

**Владение:** weather service/cache repository; погодные методы trip API после handoff; overview map/weather widgets, cities-list-dialog, overview display/export, account trip-map. Метро — association mapper/report, без конкурентных изменений dirty `tools/metro-import`.

**Задание агенту:**

> Переведи городские карты и климат на refs/ID/канонические координаты. Реализуй geo_weather_cache и weatherByPlaceId с fingerprints, concurrent upsert и legacy projection. Не переносить старый text-cache без доказательства географии. Убедись, что имя города используется только как подпись/контекст, а ID — как ключ. Поменяй overview, export и city dialogs, profile map points. Для метро связывай подтверждённый город отдельно от systemId; не ломай линии/станции и importer resolver. Не переносить фото/airport/POI marker в центр города. Попроси A6 подключить погодный picker/preview в принадлежащем ему dialog.

**Приёмка:** две одинаковые подписи в разных странах не смешивают climate/cache; resolved city map не вызывает name geocoder; latency ошибок не стирает refs; readonly/share routes и export понятны человеку. Координатный порядок и force/batch/weather refresh проверены. Не заявлять проверку фактической погоды из одного static test.

## A8. Obsidian import, AI trip и распознавание билетов

**Зависимость:** A4, A3.

**Владение:** `tools/obsidian-importer/src/` и его тесты/README; `apps/server/src/modules/ai-trip/ai-trip.service.ts`; resolver integration после booking-generation extraction. Не править trip write services A4 или flight-card A6.

**Задание агенту:**

> Внедри resolver до записи trip cities в CLI и core importer, синхронизируй transport/API client и entry points. Не меняй удобный human-readable frontmatter на обязательные UUID в Markdown. Поддержи dry-run, interactive выбор и scoped noninteractive mapping manifest. Unresolved обязательный город останавливает city write/создание до побочных изменений; existing cityIds не затираются. Server AI использует тот же путь и явный fail/needs-input результат в существующем job protocol. Для необязательных labels распознанного билета сохраняй source string и resolution status, добавляй IDs только после проверки. Контекст location/metro и названия билетов получают текст, не UUID. Опубликованный importer должен работать без private workspace runtime dependency.

**Приёмка:** CLI/core/server AI, dry-run no writes, ambiguous/nonexistent names, mapping repeat, Taiwan/Japan small destinations, booking extraction с ложным ID, failure до city mutation. Обновить fixtures контракта с сервером и руководство импорта; не ломать ручные POI/Maps URLs.

## A9. Offline snapshots, дампы и seed

**Зависимость:** A4 и DTO A1.

**Владение:** offline store/storage normalizer, dump.service.ts, seed-from-dump.ts, seed-from-mock.ts и минимальные geo fixtures. Общую schema не менять. Эти файлы не должны одновременно форматироваться другим агентом.

**Задание агенту:**

> Добавь versioned offline payload и совместимый local adapter старых snapshots без сети. Сохраняй выбранные refs, retired labels и ID weather. Только ID недостаточно. При storage failure не теряй предыдущее durable состояние. Обнови versioned dump для восстановления всех referenced geo entities/names/overrides/links и manifest без сети; восстанавливай FK в правильном порядке. Поддержи старые дампы и новые минимальные mocks. Добавление полей JSON само по себе не повод чистить IndexedDB или повышать её structural version. Существующий destructive restore не запускать на пользовательской БД.

**Приёмка:** old/new snapshot read при отключённой сети и reload, localStorage legacy/fallback, storage failure, new dump restore без интернета и старый dump. Число references/ID/order совпало до/после, orphan FK нет. Проверка в устройстве/браузере записана отдельно от unit/type checks.

## A10. Backfill, отчёты и локальная репетиция миграции

**Зависимости:** A2–A4, A6–A9; A0 audit используется как исходник, но данные перечитываются.

**Владение:** `tools/geo-migration/` (продолжение A0), scoped mapping manifests с обезличенными данными, migration runbook. SQL-структуры audit уже созданы A1.

**Задание агенту:**

> Заверши audit/resolve/apply/status CLI с dry-run default, immutable runId, fingerprints и scoped reviewed mappings. Включи JSONB flights, profile cities, trips, metro associations и отчёт старого weather cache. Автоматически применяй только правила, разрешённые планом. Сохрани legacy labels, порядок и источник каждого решения. Повтор apply безопасен; concurrent edit даёт conflict. Выполни полный цикл на локальной копии с намеренными ambiguous/island/not-found примерами, затем rollback по before fingerprints. Выпиши оставшиеся unresolved и неподтверждённые operational decisions. Подготовь точные команды и checkpoint для будущего production запуска; сам production не меняй.

**Приёмка:** dry-run zero writes, apply/reapply/cancel/resume, число исходных labels сверено с resolved/unresolved/exceptions, нет silent city swap, сохранены live changes, rollback не перезаписывает последующие правки. Полный отчёт не попал в git с персональными данными.

## A11. Интеграция, ручные проверки и готовность включения

**Зависимость:** A10 и все отчёты.

**Владение:** интегратор принимает точечные cross-file fixes, execution/final-report.md, runbook; central registries/lockfile/форматтеры только здесь или ранее по явному handoff.

**Задание агенту:**

> Пройди разделы 7–9 implementation-plan, проверь frontend/backend/CLI контракты на одном собранном checkout. Выполни необходимые lint/typecheck и смысловые integration/e2e проверки, затем ручные сценарии city picker, profile, flight segments, maps/weather, offline/restore. Проверь staged/unstaged scope и последствие formatter. Сопоставь every acceptance criterion с конкретным доказательством/ограничением. Подготовь flag rollout/rollback и список готовых локальных шагов против ещё не авторизованных production действий. Не выдавай fixture-only backfill за миграцию пользовательских данных. Передай один финальный reviewable результат с понятными командами эксплуатации.

**Приёмка:** матрица критерий → evidence; все обязательные зависимости закрыты либо явный список блокирующих gaps; восстановление и откат репетировались; ресурсы и latency измерены. Никакой формулировки «полностью внедрено» при неготовом импорте, необработанных городах или непроверенном offline.

## Формат отчёта исполнителя

```text
Задача: A<N>, статус complete/partial/blocked
Base checkout и исходные dirty границы:
Сделано и зачем:
Изменённые файлы:
Принятые/изменённые контракты:
Проверки: команда/сценарий → наблюдаемый результат
Данные: использованный snapshot/hash, fixture или настоящая локальная копия
Ограничения/непроверенное:
Зависимости для следующего агента:
Запрос владельцу общего файла (если нужен):
```

Отчёт должен позволять следующему агенту продолжить работу без полной истории чата. `complete` означает выполнение критериев конкретного задания, а не будущего production rollout.
