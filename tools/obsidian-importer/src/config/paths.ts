export const TRIP_MEDIA_ROOT_DIR = '00 - Файлы и документы'
export const LEGACY_TRIP_MEDIA_ROOT_DIR = '_'
export const TRIP_MEDIA_ROOT_DIR_NAMES = [TRIP_MEDIA_ROOT_DIR, LEGACY_TRIP_MEDIA_ROOT_DIR] as const

export function isTripMediaRootDirName(name: string): boolean {
  const normalizedName = name.normalize('NFC').trim().toLocaleLowerCase('ru')
  return TRIP_MEDIA_ROOT_DIR_NAMES.some(mediaRootName => mediaRootName.normalize('NFC').toLocaleLowerCase('ru') === normalizedName)
}
