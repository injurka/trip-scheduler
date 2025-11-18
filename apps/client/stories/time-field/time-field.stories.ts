import type { Meta, StoryObj } from '@storybook/vue3'
import { Time } from '@internationalized/date'
import { ref } from 'vue'

import { TimeField } from '../../src/components/01.kit/time-field'

/**
 * The `TimeField` component allows users to input a time (hours and minutes).
 * It is built on `reka-ui` and uses the `Time` object from `@internationalized/date`
 * for its model value.
 *
 * It supports keyboard navigation for increasing/decreasing time segments.
 */
const meta = {
  title: 'Kit/TimeField',
  component: TimeField,
  tags: ['autodocs'],
  argTypes: {
    'modelValue': {
      description: 'The `Time` object from `@internationalized/date` bound via `v-model`.',
    },
    'disabled': {
      control: 'boolean',
      description: 'Disables the time field, preventing interaction.',
    },
    'readonly': {
      control: 'boolean',
      description: 'Makes the time field non-editable, but still focusable and copyable.',
    },
    // The `placeholder` and `hourCycle` props are defined in the component,
    // but the underlying reka-ui implementation might handle them differently.
    // We will demonstrate the component's actual behavior.
    'onUpdate:modelValue': { action: 'update:modelValue' },
  },
} satisfies Meta<typeof TimeField>

export default meta
type Story = StoryObj<typeof meta>

// A reusable render function to demonstrate v-model interactivity
function interactiveRender(args: any) {
  return {
    components: { TimeField },
    setup() {
      const timeValue = ref(args.modelValue)
      return { args, timeValue }
    },
    template: `
    <div style="font-family: 'Rubik', sans-serif; display: flex; flex-direction: column; gap: 16px; width: 250px;">
      <div>
        <label for="time-field" style="display: block; margin-bottom: 8px; font-weight: 500;">Select Time</label>
        <TimeField
          v-model="timeValue"
          :disabled="args.disabled"
          :readonly="args.readonly"
          @update:modelValue="args['onUpdate:modelValue']"
        />
      </div>
      <div>
        <p style="margin: 0; font-size: 14px; color: #666;">v-model state (Time object):</p>
        <code style="font-family: monospace; background: #f0f0f0; padding: 4px 8px; border-radius: var(--r-2xs); display: inline-block; margin-top: 4px;">
          {{ timeValue ? timeValue.toString() : 'null' }}
        </code>
      </div>
    </div>
  `,
  }
}

export const Default: Story = {
  name: 'Interactive (Empty)',
  render: interactiveRender,
  args: {
    modelValue: null,
  },
  parameters: {
    docs: {
      description: {
        story: 'An interactive time field. Start typing or use arrow keys to set a time. The placeholder is shown when the value is `null`.',
      },
    },
  },
}

export const WithInitialValue: Story = {
  render: interactiveRender,
  args: {
    modelValue: new Time(14, 30),
  },
}

export const Disabled: Story = {
  render: interactiveRender,
  args: {
    modelValue: new Time(9, 0),
    disabled: true,
  },
}

export const Readonly: Story = {
  render: interactiveRender,
  args: {
    modelValue: new Time(22, 15),
    readonly: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'The field is readonly. You can focus it and select the text, but you cannot change the value.',
      },
    },
  },
}
