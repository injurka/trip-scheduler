import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'

import { DialogWithClose } from '../../src/components/01.kit/dialog-with-close'

/**
 * `DialogWithClose` is a modal component based on `reka-ui`. It provides a consistent
 * wrapper for displaying content in a dialog, complete with a title, a close button,
 * and an overlay. Control its visibility using `v-model:visible`.
 */
const meta = {
  title: 'Kit/DialogWithClose',
  component: DialogWithClose,
  tags: ['autodocs'],
  argTypes: {
    'visible': {
      description: 'Controls the visibility of the dialog (used with `v-model:visible`).',
    },
    'title': {
      control: 'text',
      description: 'The title displayed in the dialog header.',
    },
    'maxWidth': {
      control: 'number',
      description: 'The maximum width of the dialog in pixels.',
    },
    'default': {
      control: 'text',
      description: 'The main content of the dialog, passed through the default slot.',
    },
    'onUpdate:visible': { action: 'update:visible' },
  },
} satisfies Meta<typeof DialogWithClose>

export default meta
type Story = StoryObj<typeof meta>

// Reusable render function to provide a button that opens the dialog
function createRender(slotContent: string) {
  return (args: any) => ({
    components: { DialogWithClose },
    setup() {
      const visible = ref(false)
      return { args, visible, slotContent }
    },
    template: `
    <div>
      <button
        @click="visible = true"
        style="padding: 8px 16px; border-radius: var(--r-xs); background-color: #333; color: var(--fg-inverted-color); border: none; cursor: pointer;"
      >
        Open Dialog
      </button>
      <DialogWithClose v-model:visible="visible" :="args" @update:visible="args['onUpdate:visible']">
        <div v-html="slotContent"></div>
      </DialogWithClose>
    </div>
  `,
  })
}

export const Default: Story = {
  render: createRender(
    `<p>This is the main content of the dialog. You can place any components or text here.</p>
     <p>Click the 'X' button or the overlay to close it.</p>`,
  ),
  // @ts-expect-error Visible in createRender
  args: {
    title: 'Default Dialog',
    maxWidth: 700,
  },
}

export const CustomWidth: Story = {
  render: createRender(
    `<p>This dialog has a maximum width of 400px, making it suitable for smaller forms or notifications.</p>`,
  ),
  // @ts-expect-error Visible in createRender
  args: {
    title: 'Narrow Dialog',
    maxWidth: 400,
  },
}

export const WithLongContent: Story = {
  render: createRender(
    `<p>This example demonstrates how the dialog handles content that exceeds its height. The body of the dialog should become scrollable.</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
    <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
    <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
    <p>Here is some more content to ensure scrolling is triggered.</p>
    <p>And another line, just in case.</p>
    <p>Final line. You should be able to scroll now.</p>`,
  ),
  // @ts-expect-error Visible in createRender
  args: {
    title: 'Scrolling Content',
    maxWidth: 600,
  },
}

export const WithoutTitle: Story = {
  render: createRender(
    `<p>This dialog was rendered without a title prop. The header still correctly aligns the close button.</p>`,
  ),
  // @ts-expect-error Visible in createRender
  args: {

  },
}
