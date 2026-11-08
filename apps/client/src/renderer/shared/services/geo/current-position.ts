import { checkPermissions, getCurrentPosition, requestPermissions } from '@tauri-apps/plugin-geolocation'
import { isMobileApp } from '~/shared/lib/env'

/** One fresh fix, independent of activity recording and its background service. */
export async function getCurrentCoordinates(): Promise<[number, number]> {
  let coords: { longitude: number, latitude: number }

  if (isMobileApp) {
    let permission = await checkPermissions()

    if (permission.location !== 'granted')
      permission = await requestPermissions(['location'])

    if (permission.location !== 'granted' && permission.coarseLocation !== 'granted')
      throw new Error('Разрешите доступ к местоположению в настройках приложения.')

    coords = (await getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })).coords
  }
  else {
    if (!navigator.geolocation)
      throw new Error('Геолокация недоступна в этом браузере.')

    coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(position => resolve(position.coords), (error) => {
        reject(new Error(error.code === 1
          ? 'Разрешите доступ к местоположению.'
          : 'Не удалось получить GPS-позицию. Проверьте геолокацию и повторите попытку.'))
      }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
    })
  }

  if (!Number.isFinite(coords.longitude) || !Number.isFinite(coords.latitude)
    || Math.abs(coords.longitude) > 180 || Math.abs(coords.latitude) > 90) {
    throw new Error('Устройство вернуло некорректные GPS-координаты.')
  }

  return [coords.longitude, coords.latitude]
}
