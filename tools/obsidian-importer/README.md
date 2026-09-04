# 🛫 @injurka/obsidian-importer

Импорт путешествий из **Obsidian Vault** в **Trip Scheduler**: маршрут, day.meta-бейджи, активности, чек-листы, финансы, заметки и медиа.

## Возможности

- Автоматическое обнаружение вольтов и папок с турами (`@injurka/vault-locator` — реестр Obsidian + маркер `.obsidian`, WSL-пути).
- Парсинг таймлайна дня, инфо-плашек `day.meta`, таблиц бронирований и чек-листов.
- Умная генерация активностей через LLM (AIHubMix / OpenAI: Gemini 3, Claude, DeepSeek V4, GPT-5.6) или офлайн-парсер.
- Извлечение координат из ссылок Яндекс Карт / Google Maps / 2GIS / OSM, геокодинг, индексация локальных медиа и загрузка галерей.

## Install

```bash
bun add @injurka/obsidian-importer
```

## Usage

```bash
bunx --bun @injurka/obsidian-importer \
  --dir "~/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan" \
  --start-date "2026-10-29" \
  --status draft
```

Требуются переменные окружения `TRIP_API_URL` / `TRIP_API_TOKEN` (или интерактивный вход) и `AI_HUBMIX_KEY` / `OPENAI_API_KEY` для LLM-режима.

### Programmatic API

```typescript
import { parseObsidianTripFolder, runImport } from '@injurka/obsidian-importer'
import { discoverVaultFolders } from '@injurka/vault-locator'

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
