# @limiteddissolve/obsidian-importer

Импорт путешествий из **Obsidian Vault** в **Trip Scheduler**: маршрут, day.meta-бейджи, активности, чек-листы, финансы, заметки и медиа.

## Возможности

- Автоматическое обнаружение вольтов и папок с турами (реестр Obsidian + маркер `.obsidian`, WSL-пути).
- Парсинг таймлайна дня, инфо-плашек `day.meta`, таблиц бронирований и чек-листов.
- Умная генерация активностей через LLM (AIHubMix / OpenAI: Gemini 3, Claude, DeepSeek V4, GPT-5.6) или офлайн-парсер.
- Извлечение координат из ссылок Яндекс Карт / Google Maps / 2GIS / OSM, геокодинг, индексация локальных медиа и загрузка галерей.

## Install

```bash
bun add @limiteddissolve/obsidian-importer
```

## Usage

```bash
bunx --bun @limiteddissolve/obsidian-importer \
  --api-url "https://trip-scheduler-api.limited-dissolve.ru" \
  --dir "~/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan" \
  --start-date "2026-10-29" \
  --status draft
```

### Режим валидации (диагностика и аудит хранилища)

Перед импортом можно запустить глубокую проверку совместимости заметок Obsidian без записи в базу данных:

```bash
# Проверка из корня монорепозитория
bun run validate:obsidian -d "@/home/injurka/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan/02 - Маршрутный план"

# Или через CLI-флаг --validate (-v)
bun run import:obsidian --validate -d "~/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan"
```

Валидатор автоматически:

1. Поддерживает пути вида `@/path/...` и разрешает подпапки (например, `02 - Маршрутный план`) к общему корню тура.
2. Проверяет структуру мастер-файла, наличие `## 📝 Краткое описание`, городов и тегов.
3. Проверяет синтаксис строк таймлайна и находит потенциально упущенные активности (пропущенные `**`, точки вместо двоеточий).
4. Проверяет существование локальных фотографий в папке `_` по ссылкам `![[...]]`.
5. Проверяет адаптивность `<iframe>` Google Maps и бейджи `day.meta`.
6. Формирует подробный отчет с оценкой совместимости в процентах (0–100%) и рекомендациями.

Требуются переменные окружения `TRIP_API_URL` / `TRIP_API_TOKEN` (или интерактивный вход) и `AI_HUBMIX_KEY` / `OPENAI_API_KEY` для LLM-режима.

### Конфигурационный файл (`importer.config.json`)

Вы можете настроить модели нейросетей, курсы валют для сметы, разделы по умолчанию, таймауты и параметры геокодинга через `importer.config.json` в корне проекта или передать путь флагом `-c, --config <path>`:

```json
{
  "defaultModel": "gemini-3.1-flash-lite",
  "mainCurrency": "RUB",
  "exchangeRates": {
    "TWD": 2.8,
    "USD": 90.0,
    "EUR": 100.0,
    "CNY": 12.5,
    "JPY": 0.65,
    "KRW": 0.07,
    "SGD": 70.0
  },
  "llmTimeoutMs": 45000,
  "batchSize": 8
}
```

### Programmatic API

```typescript
import { discoverVaultFolders, parseObsidianTripFolder, runImport } from '@limiteddissolve/obsidian-importer'

// Найти папки туров в известных вольтах
const folders = discoverVaultFolders('Travel')

// Разобрать папку тура в структурированные данные
const trip = parseObsidianTripFolder('-- Murmansk', '2027-01-29')
// => { tripMeta, days: [...], checklists, finances, notes }

// Полный импорт (интерактивный, если нет CLI-флагов)
await runImport()
```

## License

MIT
