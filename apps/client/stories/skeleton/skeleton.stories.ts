import type { Meta, StoryObj } from '@storybook/vue3'

import { Skeleton } from '../../src/components/01.kit/skeleton'

/**
 * The `Skeleton` component is used to display a placeholder preview of your content
 * while the data is loading. It improves user experience by indicating that something
 * is happening and will appear shortly.
 */
const meta = {
  title: 'Kit/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['wave'],
      description: 'The animation type of the skeleton.',
    },
    width: {
      control: 'text',
      description: 'The width of the skeleton. Can be any valid CSS unit (e.g., "100px", "50%").',
    },
    height: {
      control: 'text',
      description: 'The height of the skeleton. Can be any valid CSS unit (e.g., "20px", "1.2em").',
    },
    borderRadius: {
      control: 'text',
      description: 'The border radius of the skeleton (e.g., "8px", "50%").',
    },
    color: {
      control: 'color',
      description: 'The background color of the skeleton.',
    },
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  decorators: [() => ({ template: '<div style="width: 300px;"><story/></div>' })],
}

export const CustomDimensions: Story = {
  args: {
    width: '250px',
    height: '50px',
  },
}

export const Circle: Story = {
  name: 'Circular Skeleton (Avatar)',
  args: {
    width: 60, // `px` is added automatically for number
    height: 60,
    borderRadius: '50%',
  },
}

export const CustomColor: Story = {
  args: {
    width: '100%',
    height: '24px',
    borderRadius: '8px',
    color: '#e0e0e0', // A light gray color for demonstration
  },
  decorators: [() => ({ template: '<div style="width: 300px;"><story/></div>' })],
}

export const TextLines: Story = {
  name: 'As Text Placeholder',
  render: args => ({
    components: { Skeleton },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 350px;">
        <h3 style="margin: 0 0 12px;">
          <Skeleton width="50%" height="28px" />
        </h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <Skeleton width="100%" height="1em" />
          <Skeleton width="95%" height="1em" />
          <Skeleton width="100%" height="1em" />
          <Skeleton width="75%" height="1em" />
        </div>
      </div>
    `,
  }),
}
