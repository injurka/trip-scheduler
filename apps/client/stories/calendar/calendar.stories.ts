import type { Meta, StoryObj } from '@storybook/vue3'
import { CalendarDate, today } from '@internationalized/date'
import { ref } from 'vue'

import { Calendar } from '../../src/components/01.kit/calendar'

/**
 * The `Calendar` component provides an accessible and themeable date picker.
 * It's built on top of `reka-ui` and uses `@internationalized/date` for date manipulation.
 *
 * It is controlled via `v-model`, which expects a `CalendarDate` object or `null`.
 */
const meta = {
  title: 'Kit/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  argTypes: {
    'modelValue': {
      description: 'The selected date, bound with v-model. Must be a `CalendarDate` object from `@internationalized/date` or `null`.',
    },
    // Listen for the update event to show it in the actions panel
    'onUpdate:modelValue': { action: 'update:modelValue' },
  },
  // Decorator to center the calendar in the view
  decorators: [
    () => ({ template: '<div style="display: flex; justify-content: center; padding: 2rem;"><story/></div>' }),
  ],
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

// Helper to get today's date in a consistent timezone for stories
const getToday = () => today('UTC')

// A reusable render function to demonstrate v-model interactivity
function interactiveRender(args: any) {
  return {
    components: { Calendar },
    setup() {
      // A ref to hold the selected date, initialized from story args
      const selectedDate = ref(args.modelValue)

      return {
        args,
        selectedDate,
      }
    },
    template: `
    <div style="font-family: 'Rubik', sans-serif;">
      <Calendar v-model="selectedDate" @update:modelValue="args['onUpdate:modelValue']" />
      <div style="margin-top: 16px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #666;">v-model state:</p>
        <code style="font-family: monospace; background: #f0f0f0; padding: 4px 8px; border-radius: var(--r-2xs);">
          {{ selectedDate ? selectedDate.toString() : 'null' }}
        </code>
      </div>
    </div>
  `,
  }
}

export const Default: Story = {
  name: 'Interactive (Default)',
  render: interactiveRender,
  args: {
    // Start with today's date selected
    modelValue: getToday(),
  },
}

export const SpecificDateSelected: Story = {
  name: 'With a Specific Date',
  render: interactiveRender,
  args: {
    // Select Valentine's Day 2024
    modelValue: new CalendarDate(2024, 2, 14),
  },
}

export const FutureDate: Story = {
  name: 'Initial View on a Future Date',
  render: interactiveRender,
  args: {
    // The calendar will open showing January 2025
    modelValue: new CalendarDate(2025, 1, 1),
  },
}

export const NoInitialDate: Story = {
  name: 'No Date Selected (null)',
  render: interactiveRender,
  args: {
    // The v-model is initially null. The component will handle this gracefully.
    // In this implementation, v-if="model" will prevent rendering until a date is picked.
    // Our interactive wrapper allows picking a date to demonstrate this.
    modelValue: null,
  },
}
