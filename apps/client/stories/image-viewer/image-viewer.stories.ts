import type { Meta, StoryObj } from '@storybook/vue3'

import type { ImageViewerImage, ImageViewerOptions } from '../../src/components/01.kit/image-viewer'
import { ImageViewer, useImageViewer } from '../../src/components/01.kit/image-viewer'

/**
 * The `ImageViewer` is a full-screen modal component for displaying single or multiple images.
 * Its state and logic are managed by the `useImageViewer` composable, which should be
 * used to open, close, and navigate the viewer.
 */
const meta = {
  title: 'Kit/ImageViewer',
  component: ImageViewer,
  tags: ['autodocs'],
  argTypes: {
    // Props of the ImageViewer component
    visible: { description: 'Controls visibility (bound to `useImageViewer().isOpen`).' },
    images: { description: 'Array of images to display (bound to `useImageViewer().images`).' },
    currentIndex: { description: 'Current image index (bound to `useImageViewer().currentIndex`).' },
    showCounter: { control: 'boolean', description: 'Show or hide the image counter.' },
    enableThumbnails: { control: 'boolean', description: 'Show or hide the thumbnail strip.' },
    closeOnOverlayClick: { control: 'boolean', description: 'Whether clicking the overlay closes the viewer.' },

    // Options for the useImageViewer composable
    // @ts-expect-error ...
    options: {
      control: 'object',
      description: 'Options passed to `useImageViewer` (e.g., `{ enableKeyboard: false }`).',
    },
  },
} satisfies Meta<typeof ImageViewer>

export default meta
type Story = StoryObj<typeof meta>

// --- Mock Data ---
const galleryImages: ImageViewerImage[] = [
  { url: 'https://picsum.photos/id/1018/1920/1080', alt: 'Mountain Landscape', caption: 'A stunning view of the mountains and a lake.' },
  { url: 'https://picsum.photos/id/1015/1920/1080', alt: 'Valley', caption: 'A river flowing through a green valley.' },
  { url: 'https://picsum.photos/id/10/1920/1080', alt: 'Forest Path' }, // No caption
  { url: 'https://picsum.photos/id/20/1920/1080', alt: 'Cityscape', caption: 'City lights at dusk.' },
  { url: 'https://picsum.photos/id/30/1920/1080', alt: 'Coffee', caption: 'A simple cup of coffee.' },
]

const singleImage: ImageViewerImage[] = [
  { url: 'https://picsum.photos/id/1040/1920/1080', alt: 'Castle', caption: 'An old castle on a hill.' },
]

// --- Reusable Render Function ---
function createRender(imageList: ImageViewerImage[]) {
  return (args: any) => ({
    components: { ImageViewer },
    setup() {
      // Use the composable to manage the viewer's state
      const viewer = useImageViewer(args.options as ImageViewerOptions)

      function openViewer(index: number) {
        viewer.open(imageList, index)
      }

      return { args, viewer, imageList, openViewer }
    },
    template: `
    <div style="font-family: 'Rubik', sans-serif;">
      <p>Click on an image to open the viewer.</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px;">
        <img
          v-for="(image, index) in imageList"
          :key="image.url"
          :src="image.url.replace('/1920/1080', '/300/200')"
          :alt="image.alt"
          @click="openViewer(index)"
          style="width: 100%; height: 100px; object-fit: cover; border-radius: var(--r-s); cursor: pointer; transition: transform 0.2s;"
          @mouseover="event => event.target.style.transform = 'scale(1.05)'"
          @mouseout="event => event.target.style.transform = 'scale(1)'"
        />
      </div>

      <!-- The Viewer Component -->
      <ImageViewer
        v-model:visible="viewer.isOpen.value"
        v-model:currentIndex="viewer.currentIndex.value"
        :images="viewer.images.value"
        :show-counter="args.showCounter"
        :enable-thumbnails="args.enableThumbnails"
        :close-on-overlay-click="args.closeOnOverlayClick"
      />
    </div>
  `,
  })
}

export const Default: Story = {
  render: createRender(galleryImages),
  // @ts-expect-error ...
  args: {
    showCounter: true,
    enableThumbnails: false,
    closeOnOverlayClick: true,
  },
}

export const WithThumbnailsAndCaptions: Story = {
  render: createRender(galleryImages),
  // @ts-expect-error ...
  args: {
    showCounter: true,
    enableThumbnails: true,
    closeOnOverlayClick: true,
  },
}

export const SingleImage: Story = {
  name: 'Single Image (No Navigation)',
  render: createRender(singleImage),
  // @ts-expect-error ...
  args: {
    showCounter: true, // Will be ignored because there's only one image
  },
}

export const NoCloseOnOverlayClick: Story = {
  render: createRender(galleryImages),
  // @ts-expect-error ...
  args: {
    showCounter: true,
    closeOnOverlayClick: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'In this example, clicking the dark overlay will not close the viewer. You must use the "X" button or the Escape key.',
      },
    },
  },
}

export const KeyboardDisabled: Story = {
  render: createRender(galleryImages),
  args: {
    showCounter: true,
    // @ts-expect-error ...
    options: {
      enableKeyboard: false,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'The `useImageViewer` composable is initialized with `{ enableKeyboard: false }`. Arrow keys and the Escape key will not work.',
      },
    },
  },
}
