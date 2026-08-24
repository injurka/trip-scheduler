# @injurkx/kit-image-viewer

Полнофункциональный, изолированный и высокопроизводительный компонент полноэкранного просмотра изображений (Image Viewer / Lightbox) для **Vue 3** с поддержкой жестов, зума, свайпов, ленты миниатюр и детальной панели EXIF-метаданных.

---

## 🌟 Особенности

- 📱 **Тач-жесты & Mobile-first**: Pinch-to-zoom (двумя пальцами), плавные свайпы между слайдами с физикой и расчетом скорости/инерции.
- 🔍 **Умный Zoom**: Зум колесиком мыши в точку курсора, двойной клик (с авто-подгонкой под пропорции высоких снимков), кнопки зума и плавный возврат в границы.
- 📊 **EXIF / Метаданные**: Боковая выдвижная панель с параметрами съемки (камера, объектив, ISO, диафрагма, выдержка, GPS-координаты с переходом на Google Maps / OpenStreetMap).
- 🖼 **Качество & Варианты**: Автоматический выбор и переключение разрешений (`medium`, `large`, `original`) с сохранением предпочтений в LocalStorage.
- 🎞 **Лента миниатюр**: Быстрая навигация по списку фотографий с плавной авто-прокруткой активного элемента в область видимости.
- ⌨️ **Клавиатурная навигация**: Стрелки `Left` / `Right` / `Space` для перелистывания, `Esc` для закрытия панели/вьюера, `Home` / `End`.
- 🧩 **Гибкая кастомизация**: Поддержка слотов (`#footer`, `#map`), кастомного резолвера ссылок `resolveUrl`, темизации через CSS-переменные.

---

## 📦 Установка

В рамках монорепозитория:

```json
{
  "dependencies": {
    "@injurkx/kit-image-viewer": "workspace:*"
  }
}
```

---

## 🚀 Быстрый старт

```vue
<script setup lang="ts">
import type { ImageViewerImage } from '@injurkx/kit-image-viewer'
import { KitImageViewer, useImageViewer } from '@injurkx/kit-image-viewer'

const viewer = useImageViewer()

const images: ImageViewerImage[] = [
  {
    url: 'https://example.com/photo1.jpg',
    alt: 'Горы',
    caption: 'Озеро в Альпах',
    variants: {
      small: 'https://example.com/photo1-thumb.jpg',
      medium: 'https://example.com/photo1-md.jpg',
      large: 'https://example.com/photo1.jpg',
    },
    meta: {
      takenAt: '2025-08-15T14:30:00Z',
      camera: { make: 'Sony', model: 'A7 IV' },
    },
  },
]

function openGallery(index = 0) {
  viewer.open(images, index)
}
</script>

<template>
  <button @click="openGallery(0)">
    Открыть просмотрщик
  </button>

  <KitImageViewer
    v-model:visible="viewer.isOpen.value"
    v-model:current-index="viewer.currentIndex.value"
    :images="viewer.images.value"
    :show-counter="true"
    :enable-thumbnails="true"
    :close-on-overlay-click="true"
  />
</template>
```

---

## ⚙️ Свойства (Props) `KitImageViewer`

| Проп                  | Тип                                       | По умолчанию     | Описание                                         |
| :-------------------- | :---------------------------------------- | :--------------- | :----------------------------------------------- |
| `visible`             | `boolean`                                 | **обязательный** | Видимость модального оверлея (`v-model:visible`) |
| `images`              | `ImageViewerImage[]`                      | `[]`             | Список изображений для отображения               |
| `currentIndex`        | `number`                                  | `0`              | Индекс текущего слайда (`v-model:current-index`) |
| `quality`             | `ImageQuality`                            | `'large'`        | Текущее выбранное качество (`v-model:quality`)   |
| `showCounter`         | `boolean`                                 | `true`           | Показывать счетчик `1 / 5` в шапке               |
| `enableThumbnails`    | `boolean`                                 | `false`          | Включить нижнюю полосу миниатюр                  |
| `closeOnOverlayClick` | `boolean`                                 | `true`           | Закрывать вьюер по клику на затемненный фон      |
| `enableKeyboard`      | `boolean`                                 | `true`           | Включить навигацию клавишами (`Esc`, стрелки)    |
| `maxZoom`             | `number`                                  | `4`              | Максимальный коэффициент масштабирования         |
| `minZoom`             | `number`                                  | `1`              | Минимальный коэффициент масштабирования          |
| `zoomStep`            | `number`                                  | `0.5`            | Шаг зума для кнопок                              |
| `enableTouch`         | `boolean`                                 | `true`           | Включить тач-жесты (зум, свайпы)                 |
| `animationDuration`   | `number`                                  | `300`            | Длительность анимаций трансформаций (мс)         |
| `showQualitySelector` | `boolean`                                 | `true`           | Показывать кнопку выбора качества в меню         |
| `showInfoButton`      | `boolean`                                 | `true`           | Показывать кнопку EXIF информации                |
| `hasNextPage`         | `boolean`                                 | `false`          | Есть ли следующая страница для пагинации         |
| `hasPrevPage`         | `boolean`                                 | `false`          | Есть ли предыдущая страница для пагинации        |
| `isFetching`          | `boolean`                                 | `false`          | Состояние фоновой дозагрузки фото                |
| `resolveUrl`          | `(url: string) => string`                 | `undefined`      | Функция трансформации/резолва путей к файлам     |
| `fetchMetadata`       | `(img: ImageViewerImage) => Promise<...>` | `undefined`      | Хук асинхронной дозагрузки EXIF метаданных       |
| `mapComponent`        | `Component`                               | `undefined`      | Компонент интерактивной карты для GPS-координат  |

---

## 📡 События (Emits)

| Событие               | Аргументы                   | Описание                                           |
| :-------------------- | :-------------------------- | :------------------------------------------------- |
| `update:visible`      | `(value: boolean)`          | Изменение видимости                                |
| `update:currentIndex` | `(value: number)`           | Изменение активного индекса                        |
| `update:quality`      | `(value: ImageQuality)`     | Смена качества (`medium` \| `large` \| `original`) |
| `close`               | `()`                        | Закрытие просмотрщика                              |
| `imageLoad`           | `(image: ImageViewerImage)` | Успешная загрузка картинки                         |
| `imageError`          | `(error: Event)`            | Ошибка загрузки картинки                           |
| `nextPage`            | `()`                        | Запрос загрузки следующей страницы изображений     |
| `prevPage`            | `()`                        | Запрос загрузки предыдущей страницы изображений    |

---

## 🧩 Слоты (Slots)

- `#footer="{ image, index, transform }"` — Кастомный футер над миниатюрами (для комментариев, времени съемки или действий).
- `#map="{ coords, center, markers }"` — Кастомный слот для рендеринга карты геолокации в панели EXIF.

---

## 🛠 Тестирование и запуск

```bash
# Запуск тестов пакета
bun --cwd ./packages/kit-image-viewer test

# Проверка типов
bun --cwd ./packages/kit-image-viewer typecheck

# Сборка библиотеки
bun --cwd ./packages/kit-image-viewer build
```
