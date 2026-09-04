# 🤖 Agent Skills Installer & Obsidian Importer Suite

CLI-инструмент для управления и установки навыков (skills) и правил (rules) искусственного интеллекта (агентов Antigravity / Cursor / Claude Code / Cline) для работы с базой знаний путешествий в Obsidian и последующего бесшовного импорта в платформу **Trip Scheduler** через `tools/obsidian-importer`.

---

## 📦 Каталог Навыков

| Навык                           | Описание                                                                                                                                                                        |          Содержимое           |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------: |
| `travel-vault-architect`        | Проектирование полной структуры тревел-проекта с нуля по эталону (`-- Taiwan`), мастер-хаб, сводный маршрутный план, фазирование и таймлайн Mermaid.                            | SKILL + 2 примера + 2 справки |
| `travel-itinerary-enricher`     | Обогащение дневных файлов, генерация интерактивных карт Google Maps iframe, расстановка callouts (`[!IMPORTANT]`, `[!CAUTION]`, `[!TIP]`), бейджи `tp-rate` и посуточные сметы. | SKILL + 1 пример + 2 справки  |
| `travel-logistics-and-budget`   | Расчет калиброванной сметы в рублях (`Финансы.md`), круговые диаграммы Mermaid Pie, каталоги `Отели.md`, `Авиаперелеты.md` и `Транспорт.md`.                                    | SKILL + 1 пример + 3 справки  |
| `travel-cultural-curator`       | Культурный код, история, жесткие таможенные запреты и штрафы (`05 - Полезная информация.md`), интерактивные чек-листы `Что попробовать и купить (Must-Try & Must-Buy).md`.      | SKILL + 1 пример + 2 справки  |
| `travel-workation-designer`     | Проектирование совмещения путешествия и удаленной работы (16:00–22:00 по Москве), требования к оптике Wi-Fi (150+ Мбит/с), спешелти-кофейни и островные уикенды.                | SKILL + 1 пример + 2 справки  |
| `travel-importer-compatibility` | Полная спецификация парсеров `tools/obsidian-importer`, регулярные выражения таймлайна, правила разметки инфо-плашек `day.meta` и чек-лист самопроверки.                        | SKILL + 1 пример + 1 справка  |
| `rules/travel-vault.md`         | Системные правила и регламент Obsidian Travel Vault для агентов.                                                                                                                |             Rule              |

---

## 🔎 Обнаружение Obsidian-вольтов

Инструменты автоматически находят Obsidian-вольты без хардкода путей:

1. **Реестр Obsidian** (`~/.config/obsidian/obsidian.json`, Windows: `%APPDATA%/obsidian/obsidian.json`, macOS: `~/Library/Application Support/obsidian/obsidian.json`) — официальный список всех вольтов.
2. **Маркер `.obsidian`** в стандартных директориях (`~/Documents`, `~/Obsidian` и подпапках).
3. **WSL**: дополнительно сканируются реестры `/mnt/c/Users/*/AppData/Roaming/obsidian/obsidian.json`.

Логика вынесена в общий workspace-пакет `packages/vault-locator` и используется обоими CLI-инструментами (через относительный импорт исходников, без сборки).

---

## 🚀 Использование

### Интерактивный запуск:

```bash
bun run skills:install
# или
bun run tools/skills-installer/src/run.ts
```

### Быстрая установка всех навыков в текущий проект:

```bash
bun run skills:install --all
```

### Установка в конкретное хранилище Obsidian (путь опционален — иначе интерактивный выбор из найденных вольтов):

```bash
bun run skills:install -t "~/Documents/obsidian-mark/Personal Note/Travel" --all
```

### Аудит готовности заметок тура к веб-импорту:

```bash
bun run skills:install --check "~/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan"
```

### Просмотр доступных навыков:

```bash
bun run skills:install --list
```

### Синхронизация шаблонов из внешнего хранилища:

```bash
# Источник по умолчанию — первый обнаруженный Travel-вольт (.agents)
bun run skills:install --sync-source
# или явно:
bun run skills:install --sync-source "~/Documents/obsidian-mark/Personal Note/Travel/.agents"
```
