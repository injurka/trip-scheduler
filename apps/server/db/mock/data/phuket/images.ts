import { getRoutePath, TRIP_ID } from './constants'

const ALL_IMAGE_FILENAMES = [
  'phuket-kata-beach.jpg',
  'phuket-big-buddha.jpg',
  'phuket-promthep-cape.jpg',
  'phuket-old-town.jpg',
  'phuket-freedom-beach-hike.jpg',
]

export const MOCK_IMAGES = ALL_IMAGE_FILENAMES.map(filename => ({
  id: crypto.randomUUID(),
  tripId: TRIP_ID,
  url: getRoutePath(filename),
  placement: 'route' as const,
  originalName: filename,
  sizeBytes: 0,
  // Добавляем остальные поля для соответствия схеме
  takenAt: null,
  latitude: null,
  longitude: null,
  width: null,
  height: null,
  variants: null,
  metadata: null,
}))
