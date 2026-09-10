import type { CarKind, OtherKind } from '../types'

/**
 * Единый источник истины для раскладки переездов по разделам платформы.
 *
 * Раздел «Авто» (`car`) — только автомобильный транспорт: такси, трансфер,
 * аренда, личное авто, авто с водителем, автобус (каждый со своей пометкой
 * `kind`). Раздел «Другое» (`other`) — паромы, катера, канатные дороги,
 * велосипеды, пешие переходы и прочие перемещения. «Поезда» (`train`) —
 * железная дорога и метро.
 *
 * Функция используется и парсером (`parsers/booking.ts`), и разовой миграцией
 * уже импортированных записей (`lib/reclassify.ts`), поэтому правила описаны
 * ровно один раз: расхождение «что парсится» и «что мигрируется» невозможно.
 */

export interface TransportTarget {
  type: 'train' | 'car' | 'other'
  icon: string
  kind?: CarKind | OtherKind
  /** false — сработало правило по умолчанию, признак не распознан */
  matched: boolean
}

interface TransportRule {
  pattern: (transport: string, segment: string) => boolean
  type: 'train' | 'car' | 'other'
  icon: string
  kind?: CarKind | OtherKind
}

/**
 * Порядок правил важен: сначала узкие признаки (паром, паром-катер, канатка,
 * велосипед), потом железная дорога, потом автомобильные. Внутри автомобильных
 * такси идёт раньше трансфера: строка «🚖 Шаттл / такси к причалу» — такси,
 * а «🚌 Шаттл Taiwan Tourist Shuttle» — автобус.
 */
const TRANSPORT_RULES: TransportRule[] = [
  { pattern: (t, s) => /паром|ferry|⛴|корабл|судно/i.test(t) || /паром|ferry|⛴/i.test(s), type: 'other', icon: 'mdi:ferry', kind: 'ferry' },
  { pattern: t => /катер|лодк|boat|⛵|парусник/i.test(t), type: 'other', icon: 'mdi:sail-boat', kind: 'boat' },
  { pattern: t => /канатн|фуникул|подъ[её]мник|cable.?car|ropeway|gondola|🚠|🚡/i.test(t), type: 'other', icon: 'mdi:gondola', kind: 'cablecar' },
  { pattern: t => /электробайк|электровелосипед|велосипед|самокат|bicycle|e-?bike|🚲|🛴/i.test(t), type: 'other', icon: 'mdi:bike', kind: 'bike' },
  { pattern: t => /пешк|пеший|пешком|🚶/i.test(t), type: 'other', icon: 'mdi:walk', kind: 'pedestrian' },
  { pattern: t => /автобус|bus|🚌/i.test(t), type: 'car', icon: 'mdi:bus', kind: 'bus' },
  { pattern: t => /метро|mrt|🚇|subway|underground/i.test(t), type: 'train', icon: 'mdi:subway-variant' },
  { pattern: t => /thsr|高鐵|скоростн|🚄|high.speed/i.test(t), type: 'train', icon: 'mdi:train-variant' },
  { pattern: t => /tra|поезд|train|🚆|🚂|emu|узкоколейн|tze-chiang/i.test(t), type: 'train', icon: 'mdi:train' },
  { pattern: t => /мотоцикл|скутер|мопед|🛵/i.test(t), type: 'car', icon: 'mdi:moped', kind: 'bike' },
  { pattern: t => /такси|taxi|🚖|grab|uber|яндекс\s*go/i.test(t), type: 'car', icon: 'mdi:taxi', kind: 'taxi' },
  { pattern: (t, s) => /аренда|прокат|rental|rent.?a.?car/i.test(t) || /аренда|прокат/i.test(s), type: 'car', icon: 'mdi:car-key', kind: 'rental' },
  { pattern: (t, s) => /трансфер|шаттл|shuttle|airport.?transfer/i.test(t) || /трансфер|шаттл/i.test(s), type: 'car', icon: 'mdi:airport-shuttle', kind: 'transfer' },
  { pattern: t => /с водителем|водител|chauffeur|driver/i.test(t), type: 'car', icon: 'mdi:car-connected', kind: 'chauffeur' },
  {
    pattern: t => /внедорожник|джип|минивэн|микроавтобус|4wd|4x4|suv/i.test(t),
    type: 'car',
    icon: 'mdi:car',
    kind: 'chauffeur',
  },
  { pattern: (t, s) => /авто|машина|car|🚗/i.test(t) || /авто|прокат/i.test(s), type: 'car', icon: 'mdi:car', kind: 'personal' },
]

/** Иконка → раздел и пометка; нужна для записей без текстовых признаков. */
export const ICON_TO_TARGET: Record<string, { type: 'car' | 'other', kind: CarKind | OtherKind }> = {
  'mdi:ferry': { type: 'other', kind: 'ferry' },
  'mdi:sail-boat': { type: 'other', kind: 'boat' },
  'mdi:gondola': { type: 'other', kind: 'cablecar' },
  'mdi:bike': { type: 'other', kind: 'bike' },
  'mdi:walk': { type: 'other', kind: 'pedestrian' },
  'mdi:bus': { type: 'car', kind: 'bus' },
  'mdi:airport-shuttle': { type: 'car', kind: 'transfer' },
  'mdi:taxi': { type: 'car', kind: 'taxi' },
  'mdi:car-key': { type: 'car', kind: 'rental' },
  'mdi:car-connected': { type: 'car', kind: 'chauffeur' },
  'mdi:moped': { type: 'car', kind: 'bike' },
}

/**
 * Классифицирует переезд по тексту колонки «Транспорт» (для миграции — по
 * сохранившимся деталям записи) с подсказкой из колонки «Сегмент».
 */
export function classifyTransportText(transportText: string, segmentText = ''): TransportTarget {
  const t = transportText.toLowerCase()
  const s = segmentText.toLowerCase()

  for (const rule of TRANSPORT_RULES) {
    if (rule.pattern(t, s))
      return { type: rule.type, icon: rule.icon, kind: rule.kind, matched: true }
  }

  // Неопознанное перемещение относим к «Другому», а не к поездам:
  // абстрактные переезды не должны попадать ни в «Авто», ни в «Поезда»
  return { type: 'other', icon: 'mdi:transit-transfer', kind: 'other', matched: false }
}
