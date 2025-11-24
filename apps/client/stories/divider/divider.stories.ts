import type { Meta, StoryObj } from '@storybook/vue3'

import { KitDivider } from '../../src/renderer/components/01.kit/kit-divider'

/**
 * The `Divider` component is used to visually separate content into distinct sections.
 * It can display text in the middle and has an optional loading state with an animation.
 */
const meta = {
  title: 'Kit/Divider',
  component: KitDivider,
  tags: ['autodocs'],
  argTypes: {
    isLoading: {
      control: 'boolean',
      description: 'Toggles the loading animation on the divider lines.',
    },
    default: {
      control: 'text',
      description: 'The content (usually text) to display in the center of the divider.',
    },
  },
  decorators: [
    () => ({ template: '<div style="width: 300px; padding: 2rem 0;"><story/></div>' }),
  ],
} satisfies Meta<typeof KitDivider>

export default meta
type Story = StoryObj<typeof meta>

export const WithText: Story = {
  render: args => ({
    components: { KitDivider },
    setup() {
      return { args }
    },
    template: '<KitDivider :isLoading="args.isLoading">{{ args.default }}</Divider>',
  }),
  args: {
    isLoading: false,
    default: 'OR',
  },
}

export const Loading: Story = {
  name: 'Loading State',
  render: WithText.render,
  args: {
    isLoading: true,
    default: 'Loading',
  },
}

export const LineOnly: Story = {
  name: 'Without Text (Line Only)',
  render: WithText.render,
  args: {
    isLoading: false,
    default: '',
  },
}

export const LoadingLineOnly: Story = {
  name: 'Loading State Without Text',
  render: WithText.render,
  args: {
    isLoading: true,
    default: '',
  },
}
