import type { ValidationReport } from './types'
import { colors } from '../config/colors'

export function printValidationReport(report: ValidationReport): void {
  const {
    context,
    tripTitle,
    descriptionShort,
    cities,
    tags,
    dates,
    days,
    totalActivities,
    totalImagesReferenced,
    totalImagesMissing,
    totalLocations,
    bookingsSummary,
    financesSummary,
    checklistsSummary,
    issues,
    score,
    status,
    readinessSummary,
  } = report

  console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}    🔍 ОБСИДИАН-ВАЛИДАТОР: ДИАГНОСТИКА СОВМЕСТИМОСТИ ХРАНИЛИЩА${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════════${colors.reset}\n`)

  // 1. Контекст проверки
  const scopeLabels: Record<string, string> = {
    'full-trip': 'Полное путешествие (корень вольта)',
    'route-plan': 'Маршрутный план (дневные заметки)',
    'single-day': 'Отдельный день маршрута',
    'single-section': 'Отдельный раздел-вкладка',
    'single-file': 'Отдельный markdown-файл',
  }

  console.log(`${colors.bright}🎯 КОНТЕКСТ ПРОВЕРКИ:${colors.reset}`)
  console.log(`  • Указанный путь:   ${colors.dim}${context.targetPath}${colors.reset}`)
  if (context.scope !== 'full-trip') {
    console.log(`  • Корень поездки:   ${colors.cyan}${context.tripRootPath}${colors.reset}`)
  }
  console.log(`  • Область анализа:  ${colors.bright}${scopeLabels[context.scope] || context.scope}${colors.reset}${context.targetSubfolder ? ` (${context.targetSubfolder})` : ''}`)
  console.log(`  • Путешествие:      ${colors.bright}${tripTitle}${colors.reset}`)
  console.log(`  • Даты и срок:      ${dates.startDate} ➔ ${dates.endDate} (${dates.durationDays} дн.)`)
  console.log(`  • Города маршрута:  ${cities.length > 0 ? cities.join(', ') : `${colors.yellow}Не определены${colors.reset}`}`)
  console.log(`  • Теги:             ${tags.length > 0 ? tags.join(', ') : '—'}`)

  if (descriptionShort) {
    const previewDesc = descriptionShort.length > 120 ? `${descriptionShort.slice(0, 117)}...` : descriptionShort
    console.log(`  • Описание (Short): ${colors.dim}«${previewDesc}»${colors.reset}`)
  }
  else {
    console.log(`  • Описание (Short): ${colors.yellow}⚠ Отсутствует (будет использована эвристика)${colors.reset}`)
  }

  // 2. Индекс совместимости (Score Badge)
  let scoreColor = colors.green
  let statusText = '🏆 Золотой стандарт совместимости'
  if (status === 'good') {
    scoreColor = colors.cyan
    statusText = '👍 Высокая степень совместимости'
  }
  else if (status === 'needs-attention') {
    scoreColor = colors.yellow
    statusText = '⚠️ Требует исправления предупреждений'
  }
  else if (status === 'critical') {
    scoreColor = colors.red
    statusText = '🔴 Обнаружены критические ошибки'
  }

  console.log(`\n${colors.bright}════════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`  ${scoreColor}${colors.bright}★ ИНДЕКС СОВМЕСТИМОСТИ: ${score}% [ ${statusText} ]${colors.reset}`)
  console.log(`${colors.bright}════════════════════════════════════════════════════════════════════════${colors.reset}\n`)

  // 3. Сводные модули
  console.log(`${colors.bright}📊 РАСПОЗНАННЫЕ КОМПОНЕНТЫ И СТАТИСТИКА:${colors.reset}`)

  // Дни и таймлайн
  const totalMeta = days.reduce((sum, d) => sum + d.metaCount, 0)
  console.log(`  ${colors.cyan}📅 Дни и расписание:${colors.reset}  ${days.length} дн. • ${totalActivities} активностей • ${totalMeta} инфо-блоков day.meta • ${totalLocations} локаций`)

  // Медиа
  const mediaStatus = totalImagesMissing === 0
    ? `${colors.green}все ${totalImagesReferenced} фото найдены на диске${colors.reset}`
    : `${colors.yellow}${totalImagesMissing} из ${totalImagesReferenced} фото не найдены в _!${colors.reset}`
  console.log(`  ${colors.cyan}📸 Медиа-вложения:${colors.reset}    ${totalImagesReferenced > 0 ? `${totalImagesReferenced} фото (${mediaStatus})` : 'нет локальных фото'}`)

  // Бронирования
  const b = bookingsSummary
  const bookingParts: string[] = []
  if (b.hotelsCount > 0)
    bookingParts.push(`🏨 ${b.hotelsCount} отелей`)
  if (b.flightsCount > 0)
    bookingParts.push(`✈️ ${b.flightsCount} рейсов`)
  if (b.trainsCount > 0)
    bookingParts.push(`🚆 ${b.trainsCount} поездов`)
  if (b.carsCount > 0)
    bookingParts.push(`🚗 ${b.carsCount} авто/трансферов`)
  if (b.attractionsCount > 0)
    bookingParts.push(`🎟️ ${b.attractionsCount} билетов`)
  console.log(`  ${colors.cyan}🏨 Бронирования:${colors.reset}      ${bookingParts.length > 0 ? bookingParts.join(', ') : 'нет записей'}`)

  // Финансы
  const f = financesSummary
  console.log(`  ${colors.cyan}💰 Смета и бюджет:${colors.reset}    ${f.transactionsCount > 0 ? `${f.categoriesCount} категорий, ${f.transactionsCount} статей на ~${f.totalRub.toLocaleString('ru-RU')} ₽` : 'нет файла сметы'}`)

  // Чек-листы
  const c = checklistsSummary
  console.log(`  ${colors.cyan}📋 Чек-листы:${colors.reset}         ${c.tasksCount > 0 ? `${c.tabsCount} вкладок, ${c.groupsCount} групп, ${c.tasksCount} пунктов (цен: ${c.tasksWithCost}, локаций: ${c.tasksWithLocation})` : 'нет чек-листов'}`)

  // 4. Посуточная диагностика дней
  if (days.length > 0) {
    console.log(`\n${colors.bright}📅 ПОСУТОЧНЫЙ СРЕЗ МАРШРУТА (${days.length} дн.):${colors.reset}`)

    for (const d of days) {
      const statusIcon = d.unparsedCandidates.length > 0
        ? `${colors.yellow}⚠️${colors.reset}`
        : (d.missingImages.length > 0 ? `${colors.yellow}🖼️${colors.reset}` : `${colors.green}✔${colors.reset}`)

      const actBadge = `${d.activitiesCount} акт.`
      const metaBadge = `${d.metaCount} инфо`
      const locBadge = d.hasIframe ? 'карта iframe' : (d.locationsCount > 0 ? `${d.locationsCount} лок.` : 'без карт')
      const imgBadge = d.imagesReferenced.length > 0
        ? (d.missingImages.length > 0 ? `${colors.red}${d.imagesReferenced.length} фото (${d.missingImages.length} нет!)${colors.reset}` : `${d.imagesReferenced.length} фото`)
        : '0 фото'
      const finBadge = d.financesTotal ? d.financesTotal : (d.hasFinances ? 'смета есть' : 'без сметы')

      console.log(`  ${statusIcon} [День ${String(d.dayNumber).padStart(2, '0')}] ${colors.bright}${d.title}${colors.reset} ${colors.dim}(${actBadge} • ${metaBadge} • ${locBadge} • ${imgBadge} • ${finBadge})${colors.reset}`)

      // Если есть нераспознанные строки
      if (d.unparsedCandidates.length > 0) {
        for (const unp of d.unparsedCandidates) {
          console.log(`      ${colors.yellow}↳ [Строка ${unp.line}] Потенциальная активность пропущена: «${unp.rawLine.slice(0, 70)}»${colors.reset}`)
          console.log(`        ${colors.cyan}Причина:${colors.reset} ${unp.reason}`)
          console.log(`        ${colors.green}Рекомендация:${colors.reset} ${unp.suggestedFix}`)
        }
      }
    }
  }

  // 5. Детальные проблемы и предупреждения
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const infos = issues.filter(i => i.severity === 'info')

  if (errors.length > 0) {
    console.log(`\n${colors.red}${colors.bright}🔴 КРИТИЧЕСКИЕ ОШИБКИ (${errors.length}):${colors.reset}`)
    for (let i = 0; i < errors.length; i++) {
      const err = errors[i]
      console.log(`  ${i + 1}. ${err.file ? `[${err.file}] ` : ''}${colors.bright}${err.message}${colors.reset}`)
      if (err.recommendation) {
        console.log(`     ${colors.cyan}👉 Решение:${colors.reset} ${err.recommendation}`)
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}${colors.bright}🟡 ПРЕДУПРЕЖДЕНИЯ И ПОТЕНЦИАЛЬНЫЕ УПУЩЕНИЯ (${warnings.length}):${colors.reset}`)
    for (let i = 0; i < warnings.length; i++) {
      const w = warnings[i]
      const locStr = w.file ? (w.line ? `[${w.file}:${w.line}] ` : `[${w.file}] `) : ''
      console.log(`  ${i + 1}. ${locStr}${w.message}`)
      if (w.recommendation) {
        console.log(`     ${colors.cyan}👉 Рекомендация:${colors.reset} ${w.recommendation}`)
      }
    }
  }

  if (infos.length > 0 && issues.length <= 8) {
    console.log(`\n${colors.dim}${colors.bright}💡 СОВЕТЫ ПО ЗОЛОТОМУ СТАНДАРТУ (${infos.length}):${colors.reset}`)
    for (let i = 0; i < infos.length; i++) {
      const inf = infos[i]
      const locStr = inf.file ? `[${inf.file}] ` : ''
      console.log(`  • ${locStr}${inf.message}`)
      if (inf.recommendation) {
        console.log(`    ${colors.dim}↳ ${inf.recommendation}${colors.reset}`)
      }
    }
  }

  // 6. Итоговый вердикт готовности
  console.log(`\n${colors.bright}════════════════════════════════════════════════════════════════════════${colors.reset}`)
  if (readinessSummary.canImport) {
    console.log(`  ${colors.green}${colors.bright}✔ ХРАНИЛИЩЕ ГОТОВО К ИМПОРТУ В TRIP SCHEDULER!${colors.reset}`)
    console.log(`  ${colors.dim}Все критические разделы и дни успешно распознаются парсером.${colors.reset}`)
  }
  else {
    console.log(`  ${colors.red}${colors.bright}✖ ИМПОРТ ЗАБЛОКИРОВАН: устраните критические ошибки выше.${colors.reset}`)
  }
  console.log(`${colors.bright}════════════════════════════════════════════════════════════════════════${colors.reset}\n`)
}
