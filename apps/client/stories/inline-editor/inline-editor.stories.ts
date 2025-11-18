import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, watch } from 'vue'

import { InlineEditorWrapper } from '../../src/components/01.kit/inline-editor'

/**
 * The `InlineEditor` component provides a lightweight, Notion-like WYSIWYG editor
 * for Markdown content. It is built on top of Milkdown.
 *
 * Use `InlineEditorWrapper` to ensure the necessary `MilkdownProvider` is available.
 */
const meta = {
  title: 'Kit/InlineEditor',
  component: InlineEditorWrapper,
  tags: ['autodocs'],
  argTypes: {
    // Props
    disabled: {
      control: 'boolean',
      description: 'Disables the editor, making it non-interactive.',
    },
    readonly: {
      control: 'boolean',
      description: 'Makes the editor non-editable but allows text selection.',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text to show when the editor is empty.',
    },
    features: {
      control: 'object',
      description: 'Object to enable or disable specific editor features.',
    },
    modelValue: {
      control: 'text',
      description: 'The Markdown content of the editor (use with v-model).',
    },

    // Events
    markdownUpdated: { action: 'markdownUpdated', description: 'Fired when the markdown content changes.' },
    updated: { action: 'updated', description: 'Fired when the editor view is updated.' },
    focus: { action: 'focus', description: 'Fired when the editor gains focus.' },
    blur: { action: 'blur', description: 'Fired when the editor loses focus.' },
  },
} satisfies Meta<typeof InlineEditorWrapper>

export default meta
type Story = StoryObj<typeof meta>

const initialContent = `## Welcome to the Inline Editor!

This is a demo of the **Milkdown**-based inline editor. You can write in _Markdown_ and see it rendered live.

- List item one
- List item two
- A \`code\` snippet

> A blockquote for your important notes.
`

// A reusable render function to show the v-model state
function render(args: any) {
  return {
    components: { InlineEditorWrapper },
    setup() {
      // Set up a ref to sync with v-model
      const content = ref(args.modelValue || '')

      // Watch for changes in Storybook controls to update the local state
      watch(() => args.modelValue, (newValue) => {
        content.value = newValue
      })

      return { args, content }
    },
    template: `
    <div style="font-family: 'Rubik', sans-serif;">
      <p><strong>Editor:</strong></p>
      <div style="border: 1px solid #ccc; border-radius: var(--r-s); padding: 4px; min-height: 80px;">
        <InlineEditorWrapper
          v-model="content"
          :disabled="args.disabled"
          :readonly="args.readonly"
          :placeholder="args.placeholder"
          :features="args.features"
          @markdown-updated="args.markdownUpdated"
          @updated="args.updated"
          @focus="args.focus"
          @blur="args.blur"
        />
      </div>

      <p style="margin-top: 24px;"><strong>Live Markdown Output (v-model):</strong></p>
      <pre style="background: #f4f4f4; border: 1px solid #ddd; padding: 10px; border-radius: var(--r-2xs); white-space: pre-wrap; word-break: break-all;">{{ content }}</pre>
    </div>
  `,
  }
}

export const Default: Story = {
  render,
  args: {
    placeholder: 'Start typing your story here...',
    modelValue: '',
  },
}

export const WithInitialContent: Story = {
  render,
  args: {
    modelValue: initialContent,
  },
}

export const Disabled: Story = {
  render,
  args: {
    modelValue: 'This content is not editable.',
    disabled: true,
  },
}

export const Readonly: Story = {
  render,
  args: {
    modelValue: 'This content is readonly. You can select it, but not edit.',
    readonly: true,
  },
}

export const CustomPlaceholder: Story = {
  render,
  args: {
    placeholder: 'Напишите что-нибудь о вашем путешествии... ✈️',
    modelValue: '',
  },
}
