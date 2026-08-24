<script setup lang="ts">
import type { ImageViewerImage } from '../src'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { KitImageViewer, useImageViewer } from '../src'

const viewer = useImageViewer()

const demoGalleries: { name: string, description: string, images: ImageViewerImage[] }[] = [
  {
    name: 'Альпы и пейзажи (с полным EXIF и GPS)',
    description: 'Фотографии с высоким разрешением, метаданными камеры Sony и координатами в Альпах',
    images: [
      {
        url: 'https://picsum.photos/id/1018/1920/1080',
        alt: 'Горная долина на рассвете',
        caption: 'Озеро в долине среди высоких гор на закате солнца. Вид с перевала Сен-Бернар.',
        variants: {
          small: 'https://picsum.photos/id/1018/300/200',
          medium: 'https://picsum.photos/id/1018/1280/720',
          large: 'https://picsum.photos/id/1018/1920/1080',
        },
        meta: {
          width: 1920,
          height: 1080,
          takenAt: '2025-08-15T14:30:00.000Z',
          latitude: 45.8326,
          longitude: 6.8652,
          camera: {
            make: 'Sony',
            model: 'ILCE-7RM4',
            lens: 'FE 24-70mm F2.8 GM',
          },
          settings: {
            iso: 100,
            aperture: 8,
            exposureTime: 0.004,
            shutterSpeed: '1/250s',
            focalLength: 35,
            flash: false,
            exposureMode: 0,
            meteringMode: 2,
            whiteBalance: 0,
          },
          technical: {
            format: 'JPEG',
            fileSize: 4520000,
          },
        },
      },
      {
        url: 'https://picsum.photos/id/1015/1920/1080',
        alt: 'Река в хвойном лесу',
        caption: 'Быстрая река, протекающая через горный национальный парк.',
        variants: {
          small: 'https://picsum.photos/id/1015/300/200',
          medium: 'https://picsum.photos/id/1015/1280/720',
          large: 'https://picsum.photos/id/1015/1920/1080',
        },
        meta: {
          width: 1920,
          height: 1080,
          takenAt: '2025-08-16T11:15:00.000Z',
          latitude: 46.5197,
          longitude: 6.6323,
          camera: {
            make: 'Canon',
            model: 'EOS R5',
            lens: 'RF 15-35mm F2.8L IS USM',
          },
          settings: {
            iso: 200,
            aperture: 5.6,
            exposureTime: 0.002,
            shutterSpeed: '1/500s',
            focalLength: 24,
            flash: false,
          },
          technical: {
            format: 'JPEG',
            fileSize: 5210000,
          },
        },
      },
      {
        url: 'https://picsum.photos/id/1036/1920/1080',
        alt: 'Туманный горный хребет',
        caption: 'Утренний туман над заснеженными пиками.',
        variants: {
          small: 'https://picsum.photos/id/1036/300/200',
          large: 'https://picsum.photos/id/1036/1920/1080',
        },
        meta: {
          width: 1920,
          height: 1080,
          takenAt: '2025-08-17T07:45:00.000Z',
          camera: {
            make: 'Fujifilm',
            model: 'X-T5',
            lens: 'XF 16-80mm F4 R OIS WR',
          },
          settings: {
            iso: 160,
            aperture: 4,
            shutterSpeed: '1/400s',
            focalLength: 50,
          },
        },
      },
      {
        url: 'https://picsum.photos/id/1043/1920/1080',
        alt: 'Лес и закатное небо',
        variants: {
          small: 'https://picsum.photos/id/1043/300/200',
          large: 'https://picsum.photos/id/1043/1920/1080',
        },
      },
    ],
  },
  {
    name: 'Вертикальные портреты (тест Smart Scale)',
    description: 'Изображения книжной ориентации для проверки адаптивного зума по двойному клику',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80',
        alt: 'Портрет девушки',
        caption: 'Вертикальный портрет при естественном свете.',
        variants: {
          small: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=80',
          large: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80',
        },
        meta: {
          width: 1200,
          height: 1800,
          camera: { make: 'Nikon', model: 'Z7 II', lens: 'NIKKOR Z 85mm f/1.8 S' },
        },
      },
      {
        url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&q=80',
        alt: 'Мужской портрет',
        variants: {
          small: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80',
          large: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&q=80',
        },
        meta: {
          width: 1200,
          height: 1800,
        },
      },
    ],
  },
  {
    name: 'Кастомные варианты качества (Dynamic Variants)',
    description: 'Демонстрация автоматической адаптации к любому набору полей в variants (preview, hd, fhd, 4k, raw)',
    images: [
      {
        url: 'https://picsum.photos/id/1025/3840/2160',
        alt: 'Собака в одеяле',
        caption: 'Фотография с множеством динамических вариантов разрешения от превью до 4K',
        variants: {
          'preview': 'https://picsum.photos/id/1025/200/120',
          'small': 'https://picsum.photos/id/1025/400/240',
          'medium': 'https://picsum.photos/id/1025/800/480',
          'hd': 'https://picsum.photos/id/1025/1280/720',
          'fhd': 'https://picsum.photos/id/1025/1920/1080',
          '2k': 'https://picsum.photos/id/1025/2560/1440',
          '4k': 'https://picsum.photos/id/1025/3840/2160',
          'raw': 'https://picsum.photos/id/1025/3840/2160',
        },
        meta: {
          width: 3840,
          height: 2160,
          camera: { make: 'Hasselblad', model: 'X2D 100C', lens: 'XCD 2,5/55V' },
        },
      },
      {
        url: 'https://picsum.photos/id/1062/1920/1080',
        alt: 'Собака на природе',
        caption: 'Изображение с нестандартными ключами (thumb, web, print)',
        variants: {
          thumb: 'https://picsum.photos/id/1062/200/200',
          web: 'https://picsum.photos/id/1062/1200/800',
          print: 'https://picsum.photos/id/1062/1920/1080',
        },
      },
    ],
  },
  {
    name: '⚡ Стресс-тест: Массив из 150 фотографий (Big Data / Virtualized)',
    description: 'Проверка производительности, свайпов, плавной навигации и авто-прокрутки ленты миниатюр при 150+ элементах',
    images: generateMassiveGallery(150),
  },
  {
    name: 'Краевой кейс: Битые изображения (Error Handling)',
    description: 'Проверка отображения лоадеров и плейсхолдеров при 404',
    images: [
      {
        url: 'https://non-existent-domain-12345.xyz/broken.jpg',
        alt: 'Битый URL',
        caption: 'Это изображение заведомо не загрузится',
      },
      {
        url: 'https://picsum.photos/id/10/1920/1080',
        alt: 'Рабочее изображение',
      },
    ],
  },
]

function generateMassiveGallery(count = 150): ImageViewerImage[] {
  const topics = ['Природа', 'Горы', 'Океан', 'Архитектура', 'Путешествия', 'Улицы', 'Лес', 'Закат']
  return Array.from({ length: count }, (_, i) => {
    const id = (i % 80) + 10
    const topic = topics[i % topics.length]
    return {
      url: `https://picsum.photos/id/${id}/1920/1080`,
      alt: `Фото #${i + 1} (${topic})`,
      caption: `Кадр #${i + 1}: Снимок из коллекции "${topic}". Индекс ${i + 1} из ${count}.`,
      variants: {
        small: `https://picsum.photos/id/${id}/300/200`,
        medium: `https://picsum.photos/id/${id}/1280/720`,
        large: `https://picsum.photos/id/${id}/1920/1080`,
      },
      meta: {
        width: 1920,
        height: 1080,
        takenAt: new Date(Date.now() - i * 3600000 * 12).toISOString(),
        camera: {
          make: i % 2 === 0 ? 'Sony' : 'Canon',
          model: i % 2 === 0 ? 'A7R V' : 'EOS R5',
          lens: '24-70mm F2.8',
        },
        settings: {
          iso: 100 + (i % 8) * 100,
          aperture: 2.8 + (i % 4) * 1.4,
          shutterSpeed: `1/${250 + (i % 5) * 250}s`,
        },
      },
    }
  })
}

const selectedGalleryIndex = ref(0)
const enableThumbnails = ref(true)
const showCounter = ref(true)
const closeOnOverlayClick = ref(true)
const showQualitySelector = ref(true)
const showInfoButton = ref(true)
const failedImages = ref<Set<string>>(new Set())

function openViewer(galleryIndex: number, imageIndex = 0) {
  selectedGalleryIndex.value = galleryIndex
  const list = demoGalleries[galleryIndex].images
  viewer.open(list, imageIndex)
}
</script>

<template>
  <div class="playground">
    <header class="playground-header">
      <div class="header-left">
        <Icon icon="mdi:image-multiple" class="logo-icon" />
        <div>
          <h1>Kit Image Viewer Playground</h1>
          <p>Интерактивная среда для разработки и тестирования компонента</p>
        </div>
      </div>
      <div class="header-right">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener"
          class="gh-link"
        >
          <Icon icon="mdi:github" />
          <span>v1.0.0</span>
        </a>
      </div>
    </header>

    <div class="playground-content">
      <aside class="sidebar">
        <h2>Настройки просмотрщика</h2>

        <div class="settings-group">
          <label class="setting-item">
            <input v-model="enableThumbnails" type="checkbox">
            <span>Миниатюры (`enableThumbnails`)</span>
          </label>

          <label class="setting-item">
            <input v-model="showCounter" type="checkbox">
            <span>Счетчик фото (`showCounter`)</span>
          </label>

          <label class="setting-item">
            <input v-model="closeOnOverlayClick" type="checkbox">
            <span>Закрывать по оверлею (`closeOnOverlayClick`)</span>
          </label>

          <label class="setting-item">
            <input v-model="showQualitySelector" type="checkbox">
            <span>Выбор качества (`showQualitySelector`)</span>
          </label>

          <label class="setting-item">
            <input v-model="showInfoButton" type="checkbox">
            <span>Кнопка EXIF (`showInfoButton`)</span>
          </label>
        </div>

        <div class="hotkeys-info">
          <h3>Горячие клавиши</h3>
          <ul>
            <li><kbd>→</kbd> / <kbd>Space</kbd> — Следующее фото</li>
            <li><kbd>←</kbd> — Предыдущее фото</li>
            <li><kbd>Esc</kbd> — Закрыть EXIF / вьюер</li>
            <li><kbd>Home</kbd> / <kbd>End</kbd> — Первое / последнее</li>
            <li><kbd>Двойной клик</kbd> — Умный зум</li>
            <li><kbd>Колесико</kbd> — Зум к курсору</li>
          </ul>
        </div>
      </aside>

      <main class="main-area">
        <section
          v-for="(gallery, gIdx) in demoGalleries"
          :key="gallery.name"
          class="gallery-card"
        >
          <div class="gallery-card-header">
            <div>
              <h3>{{ gallery.name }}</h3>
              <p>{{ gallery.description }}</p>
            </div>
            <button class="open-gallery-btn" @click="openViewer(gIdx, 0)">
              <Icon icon="mdi:play" />
              <span>Смотреть</span>
            </button>
          </div>

          <div class="grid-preview">
            <div
              v-for="(img, iIdx) in gallery.images.slice(0, 12)"
              :key="`${img.url}-${iIdx}`"
              class="thumb-item"
              :class="{ 'is-broken': failedImages.has(img.variants?.small || img.url) }"
              @click="openViewer(gIdx, iIdx)"
            >
              <template v-if="!failedImages.has(img.variants?.small || img.url)">
                <img
                  :src="img.variants?.small || img.url"
                  :alt="img.alt"
                  loading="lazy"
                  @error="failedImages.add(img.variants?.small || img.url)"
                >
                <div class="thumb-overlay">
                  <Icon icon="mdi:magnify-plus" />
                </div>
              </template>
              <div v-else class="broken-thumb-content">
                <Icon icon="mdi:image-broken-variant" class="broken-icon" />
                <span class="broken-title">Ошибка загрузки</span>
                <span class="broken-sub">Кликните для теста 404</span>
              </div>
            </div>

            <div
              v-if="gallery.images.length > 12"
              class="thumb-item more-card"
              @click="openViewer(gIdx, 12)"
            >
              <div class="more-card-content">
                <span class="more-count">+{{ gallery.images.length - 12 }}</span>
                <span class="more-text">Еще фото</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- Модальный просмотрщик -->
    <KitImageViewer
      v-model:visible="viewer.isOpen.value"
      v-model:current-index="viewer.currentIndex.value"
      :images="viewer.images.value"
      :show-counter="showCounter"
      :enable-thumbnails="enableThumbnails"
      :close-on-overlay-click="closeOnOverlayClick"
      :show-quality-selector="showQualitySelector"
      :show-info-button="showInfoButton"
    />
  </div>
</template>

<style scoped>
.playground {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.playground-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-icon {
  font-size: 36px;
  color: #3b82f6;
}

.header-left h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
}

.header-left p {
  margin: 4px 0 0 0;
  font-size: 0.85rem;
  color: #888;
}

.gh-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #aaa;
  text-decoration: none;
  font-size: 0.9rem;
  padding: 6px 14px;
  border: 1px solid #333;
  border-radius: 8px;
  transition: all 0.2s;
}

.gh-link:hover {
  color: #fff;
  border-color: #555;
  background: #252525;
}

.playground-content {
  flex: 1;
  display: flex;
  gap: 32px;
  padding: 32px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
  background: #181818;
  border: 1px solid #282828;
  border-radius: 12px;
  padding: 20px;
  height: fit-content;
}

.sidebar h2 {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #ccc;
  cursor: pointer;
}

.setting-item input[type='checkbox'] {
  accent-color: #3b82f6;
  width: 16px;
  height: 16px;
}

.hotkeys-info {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid #282828;
}

.hotkeys-info h3 {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hotkeys-info ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hotkeys-info li {
  font-size: 0.85rem;
  color: #bbb;
  display: flex;
  align-items: center;
  gap: 8px;
}

kbd {
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 0.8rem;
  color: #fff;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.gallery-card {
  background: #181818;
  border: 1px solid #282828;
  border-radius: 12px;
  padding: 24px;
}

.gallery-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.gallery-card-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.gallery-card-header p {
  margin: 6px 0 0 0;
  font-size: 0.85rem;
  color: #888;
}

.open-gallery-btn {
  background: #3b82f6;
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.open-gallery-btn:hover {
  background: #2563eb;
}

.grid-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.thumb-item {
  position: relative;
  aspect-ratio: 16/10;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: #222;
  border: 1px solid #333;
}

.thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}

.thumb-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s;
}

.thumb-item:hover img {
  transform: scale(1.05);
}

.thumb-item:hover .thumb-overlay {
  opacity: 1;
}

.thumb-item.is-broken {
  background: linear-gradient(135deg, #1f1414 0%, #2a1818 100%);
  border: 1px dashed rgba(239, 68, 68, 0.4);
  transition: all 0.2s;
}

.thumb-item.is-broken:hover {
  border-color: rgba(239, 68, 68, 0.8);
  background: linear-gradient(135deg, #2a1818 0%, #3a1e1e 100%);
  transform: translateY(-2px);
}

.broken-thumb-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  text-align: center;
  gap: 4px;
  user-select: none;
}

.broken-icon {
  font-size: 24px;
  color: #ef4444;
  opacity: 0.9;
}

.broken-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #fca5a5;
}

.broken-sub {
  font-size: 0.65rem;
  color: #888;
}

.thumb-item.more-card {
  background: #202024;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.thumb-item.more-card:hover {
  background: #2c2c34;
  border-color: #3b82f6;
  transform: translateY(-2px);
}

.more-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  user-select: none;
}

.more-count {
  font-size: 1.25rem;
  font-weight: 700;
  color: #3b82f6;
}

.more-text {
  font-size: 0.75rem;
  color: #94a3b8;
}

@media (max-width: 900px) {
  .playground-content {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
  }
}
</style>
