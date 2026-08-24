import type { Meta, StoryObj } from '@storybook/vue3'
import type { ImageViewerImage, ImageViewerOptions } from '../src'
import { KitImageViewer, useImageViewer } from '../src'

const meta = {
  title: 'Packages/KitImageViewer',
  component: KitImageViewer,
  tags: ['autodocs'],
  argTypes: {
    visible: { description: 'Управляет видимостью просмотрщика' },
    images: { description: 'Массив отображаемых изображений' },
    currentIndex: { description: 'Индекс текущего изображения' },
    showCounter: { control: 'boolean', description: 'Показывать счетчик изображений' },
    enableThumbnails: { control: 'boolean', description: 'Включить ленту миниатюр' },
    closeOnOverlayClick: { control: 'boolean', description: 'Закрывать по клику на оверлей' },
    showQualitySelector: { control: 'boolean', description: 'Показывать селектор качества' },
    showInfoButton: { control: 'boolean', description: 'Показывать кнопку информации (EXIF)' },
    enableKeyboard: { control: 'boolean', description: 'Управление с клавиатуры' },
  },
} satisfies Meta<typeof KitImageViewer>

export default meta
type Story = StoryObj<any>

const sampleImages: ImageViewerImage[] = [
  {
    url: 'https://picsum.photos/id/1018/1920/1080',
    alt: 'Горный пейзаж',
    caption: 'Озеро в долине среди высоких гор на закате солнца.',
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
    alt: 'Речная долина',
    caption: 'Быстрая река, протекающая через хвойный лес.',
    variants: {
      small: 'https://picsum.photos/id/1015/300/200',
      medium: 'https://picsum.photos/id/1015/1280/720',
      large: 'https://picsum.photos/id/1015/1920/1080',
    },
    meta: {
      width: 1920,
      height: 1080,
      takenAt: '2025-08-16T11:15:00.000Z',
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
      },
    },
  },
  {
    url: 'https://picsum.photos/id/10/1920/1080',
    alt: 'Лесная тропа',
    variants: {
      small: 'https://picsum.photos/id/10/300/200',
      large: 'https://picsum.photos/id/10/1920/1080',
    },
  },
  {
    url: 'https://picsum.photos/id/20/1920/1080',
    alt: 'Рабочий стол',
    caption: 'Минималистичное рабочее пространство с ноутбуком.',
    variants: {
      small: 'https://picsum.photos/id/20/300/200',
      large: 'https://picsum.photos/id/20/1920/1080',
    },
  },
]

function createGalleryStory(imageList: ImageViewerImage[]) {
  return (args: any) => ({
    components: { KitImageViewer },
    setup() {
      const viewer = useImageViewer(args.options as ImageViewerOptions)

      function openViewer(index: number) {
        viewer.open(imageList, index)
      }

      return { args, viewer, imageList, openViewer }
    },
    template: `
      <div style="font-family: system-ui, sans-serif; padding: 24px; background: #181818; color: #fff; border-radius: 12px;">
        <h3 style="margin-top: 0;">Демонстрация галереи (кликните для просмотра)</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-top: 16px;">
          <div
            v-for="(image, index) in imageList"
            :key="image.url"
            @click="openViewer(index)"
            style="aspect-ratio: 16/10; overflow: hidden; border-radius: 8px; cursor: pointer; border: 1px solid #333; transition: transform 0.2s, box-shadow 0.2s;"
            @mouseover="$event.currentTarget.style.transform = 'scale(1.03)'"
            @mouseout="$event.currentTarget.style.transform = 'scale(1)'"
          >
            <img
              :src="image.variants?.small || image.url"
              :alt="image.alt"
              style="width: 100%; height: 100%; object-fit: cover;"
            />
          </div>
        </div>

        <KitImageViewer
          v-model:visible="viewer.isOpen.value"
          v-model:current-index="viewer.currentIndex.value"
          :images="viewer.images.value"
          :show-counter="args.showCounter"
          :enable-thumbnails="args.enableThumbnails"
          :close-on-overlay-click="args.closeOnOverlayClick"
          :show-quality-selector="args.showQualitySelector"
          :show-info-button="args.showInfoButton"
          :enable-keyboard="args.enableKeyboard"
        />
      </div>
    `,
  })
}

export const Default: Story = {
  render: createGalleryStory(sampleImages),
  args: {
    showCounter: true,
    enableThumbnails: true,
    closeOnOverlayClick: true,
    showQualitySelector: true,
    showInfoButton: true,
    enableKeyboard: true,
  },
}

export const SingleImage: Story = {
  name: 'Одиночное изображение без навигации',
  render: createGalleryStory([sampleImages[0]]),
  args: {
    showCounter: false,
    enableThumbnails: false,
    closeOnOverlayClick: true,
    showQualitySelector: true,
    showInfoButton: true,
    enableKeyboard: true,
  },
}

export const CustomFooterSlot: Story = {
  name: 'Кастомный слот футера (#footer)',
  render: (args: any) => ({
    components: { KitImageViewer },
    setup() {
      const viewer = useImageViewer()
      function openViewer(index: number) {
        viewer.open(sampleImages, index)
      }
      return { args, viewer, sampleImages, openViewer }
    },
    template: `
      <div style="font-family: system-ui, sans-serif; padding: 24px; background: #181818; color: #fff; border-radius: 12px;">
        <button
          @click="openViewer(0)"
          style="padding: 10px 20px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;"
        >
          Открыть просмотрщик с кастомным футером
        </button>

        <KitImageViewer
          v-model:visible="viewer.isOpen.value"
          v-model:current-index="viewer.currentIndex.value"
          :images="viewer.images.value"
          :show-counter="true"
          :enable-thumbnails="false"
        >
          <template #footer="{ image, index }">
            <div style="background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); padding: 12px 24px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; text-align: center;">
              <strong>{{ image?.alt }}</strong>
              <div v-if="image?.caption" style="font-size: 0.85rem; color: #ccc; margin-top: 4px;">{{ image.caption }}</div>
            </div>
          </template>
        </KitImageViewer>
      </div>
    `,
  }),
}
