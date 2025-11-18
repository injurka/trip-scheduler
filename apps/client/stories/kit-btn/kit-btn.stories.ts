import type { Meta, StoryObj } from '@storybook/vue3'

import { KitBtn } from '../../src/components/01.kit/kit-btn'

const meta = {
  title: 'Kit/Button',
  component: KitBtn,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['solid', 'outlined'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary'],
    },
    disabled: {
      control: 'boolean',
    },
    icon: {
      control: 'text',
    },
    default: {
      name: 'slot content',
      control: 'text',
    },
  },
  // Global render function to handle props and slots for all stories
  render: args => ({
    components: { KitBtn },
    setup() {
      return { args }
    },
    template: `<KitBtn v-bind="args">{{ args.default }}</KitBtn>`,
  }),
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof KitBtn>

export default meta
type Story = StoryObj<typeof meta>

// Reusable default arguments for stories
const defaultArgs = {
  default: 'Button',
  disabled: false,
  icon: undefined,
}

export const Primary: Story = {
  args: {
    ...defaultArgs,
    variant: 'solid',
    color: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    ...defaultArgs,
    default: 'Secondary',
    variant: 'solid',
    color: 'secondary',
  },
}

export const Outlined: Story = {
  args: {
    ...defaultArgs,
    default: 'Outlined',
    variant: 'outlined',
    color: 'primary',
  },
}

export const WithIcon: Story = {
  args: {
    ...defaultArgs,
    default: 'Launch',
    icon: 'mdi:rocket-launch-outline',
    variant: 'solid',
    color: 'primary',
  },
}

export const Disabled: Story = {
  args: {
    ...defaultArgs,
    default: 'Disabled',
    disabled: true,
  },
}
