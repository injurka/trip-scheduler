# 🤖 @injurka/skills-installer

CLI для установки AI-навыков (skills) и правил (rules) для работы с тревел-базой знаний в Obsidian и последующего импорта туров в Trip Scheduler. Навыки совместимы с Antigravity / Cursor / Claude Code / Cline (`.agents/skills`, `.cursor/rules`, `.claude/skills`).

## Возможности

- Каталог из 6 travel-навыков (проектирование вольта, обогащение маршрута, логистика и бюджет, культурный код, workation, совместимость с импортёром) + системные правила.
- Установка в проект, Obsidian-вольт или глобальную папку агентов; интерактивный выбор цели с автообнаружением вольтов.
- Проверка готовности папки тура в Obsidian к импорту (`--check`).
- Синхронизация исходников навыков из внешнего хранилища агентов (`--sync-source`).

## Install

```bash
bun add @injurka/skills-installer
```

## Usage

```bash
bunx --bun @injurka/skills-installer/bin --list
```

### Programmatic API

```typescript
import { detectCandidateTargets, installSkill, resolveTargetDir, validateTripFolder } from '@injurka/skills-installer'

// Куда можно ставить: проект / вольт / глобал (вольты ищутся через @injurka/vault-locator)
const targets = detectCandidateTargets()

// Разрешить целевую директорию (создаёт agents/skills/rules структуру)
const { agentsDir, skillsDir, rulesDir } = resolveTargetDir('~/Documents/obsidian-mark/Personal Note/Travel')

// Установить навык в целевую папку
const result = installSkill('/path/to/skill-source', '/target/.agents/skills/travel-vault-architect')
// => { copied: 12, skipped: 0 }

// Проверить готовность папки тура к obsidian-importer
const report = validateTripFolder('~/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan')
```

## License

MIT
