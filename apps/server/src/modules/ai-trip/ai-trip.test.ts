import { describe, expect, it } from 'bun:test'
import {
  rewriteHubFrontmatterCities,
  stripTripWrapper,
  validateDailyBatchFiles,
  validateOverviewFiles,
  validateSectionsFiles,
} from './ai-trip.service'

describe('ai-trip validators & helpers', () => {
  it('strips an unintended outer trip folder wrapper while keeping standard directories', () => {
    const wrapped = stripTripWrapper([
      { path: '-- Япония Осень/Япония Осень.md', content: '# Япония Осень' },
      { path: '-- Япония Осень/02 - Маршрутный план/Маршрутный план.md', content: '# План' },
    ])

    expect(wrapped).toEqual([
      { path: 'Япония Осень.md', content: '# Япония Осень' },
      { path: '02 - Маршрутный план/Маршрутный план.md', content: '# План' },
    ])
  })

  it('validates overview and sections chunks structurally', () => {
    const overviewOk = validateOverviewFiles([
      { path: 'Япония.md', content: '# Осенняя Япония\n\n## 📝 Краткое описание\nОписание.' },
      { path: '02 - Маршрутный план/Маршрутный план.md', content: '# Маршрутный план' },
      { path: '05 - Полезная информация/Полезная информация.md', content: '# Полезно' },
    ])
    expect(overviewOk.success).toBe(true)

    const sectionsFail = validateSectionsFiles([
      { path: '03 - Бронирования/Отели.md', content: '| Ночи | Локация |' },
    ])
    expect(sectionsFail.success).toBe(false)
  })

  it('validates daily batch activities and rejects excluded places', () => {
    const validDayContent = [
      '# День 01 — Токио',
      '> [!INFO] Погода +18°C',
      '* **09:00 - 11:00** — Храм Сэнсо-дзи в Асакусе',
      '* **12:00 - 13:30** — Обед на рынке Цукидзи',
      '* **15:00 - 18:00** — Смотровая площадка Сибуя Скай',
    ].join('\n')

    const okResult = validateDailyBatchFiles(
      [{ path: '02 - Маршрутный план/01 Токио (сб) — Старт.md', content: validDayContent }],
      1,
      1,
      ['Диснейленд'],
    )
    expect(okResult.success).toBe(true)

    const excludedHit = validateDailyBatchFiles(
      [{ path: '02 - Маршрутный план/01 Токио (сб) — Старт.md', content: validDayContent }],
      1,
      1,
      ['Сибуя Скай'],
    )
    expect(excludedHit.success).toBe(false)
  })

  it('rewrites multiline or inline YAML cities in hub frontmatter cleanly', () => {
    const md = [
      '---',
      'slug: japan-autumn',
      'cities:',
      '  - Город Фуникулеров',
      '  - Токио',
      'tags: [japan]',
      '---',
      '# Япония',
    ].join('\n')

    const updated = rewriteHubFrontmatterCities(md, ['Токио', 'Киото'])
    expect(updated).toContain('cities: ["Токио", "Киото"]')
    expect(updated).not.toContain('Город Фуникулеров')
    expect(updated).toContain('slug: japan-autumn')
    expect(updated).toContain('# Япония')
  })
})
