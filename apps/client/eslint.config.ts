import antfu from '@antfu/eslint-config'
import storybook from 'eslint-plugin-storybook'
import vueSetupOrder from 'eslint-plugin-vue-setup-order'

export default antfu({
  vue: true,
  markdown: false,
  formatters: true,
  ignores: [
    '**/.vitestcache/**',
    '**/e2e-**/**',
    '**/assets/**',
    '**/public/**',
    'auto-imports.d.ts',
    'bun.lock',
    'maplibre-gl-worker.js',
  ],
  rules: {
    'e18e/prefer-static-regex': 'off',
    'antfu/reasonable-newline': 'off',
    // === ВИЗУАЛЬНОЕ РАЗДЕЛЕНИЕ КОДА ===
    // Заставляет делать пустые строки перед функциями, return и после if/for
    'style/padding-line-between-statements': ['error', { blankLine: 'always', prev: 'import', next: '*' }, { blankLine: 'never', prev: 'import', next: 'import' }, { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'switch', 'try'] }, { blankLine: 'always', prev: ['if', 'for', 'while', 'switch', 'try'], next: '*' }, { blankLine: 'always', prev: '*', next: 'return' }],

    // === БАЗОВЫЕ ПРАВИЛА ===
    'complexity': ['error', { max: 10 }],
    'vue/define-macros-order': ['error', {
      order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'],
    }],
    'vue/block-order': ['error', {
      order: ['script', 'template', 'style'],
    }],
    'vue/max-attributes-per-line': ['error', {
      singleline: { max: 3 },
      multiline: { max: 1 },
    }],
    'vue/first-attribute-linebreak': ['error', {
      singleline: 'ignore',
      multiline: 'below',
    }],
    'vue/html-closing-bracket-newline': ['error', {
      singleline: 'never',
      multiline: 'always',
    }],
    'style/function-paren-newline': ['error', { minItems: 4 }],
    'style/object-curly-newline': ['error', {
      ExportDeclaration: { consistent: true, minProperties: 5, multiline: true },
      ObjectExpression: { consistent: true, minProperties: 5, multiline: true },
      ObjectPattern: { consistent: true, minProperties: 5, multiline: true },
    }],
    'style/object-property-newline': ['error', {
      allowAllPropertiesOnSameLine: true,
    }],
    'no-restricted-syntax': [
      'error',
      {
        message: 'Не пишите пропсы инлайн в defineProps<{ ... }>(). Выделяйте отдельный interface Props.',
        selector: 'CallExpression[callee.name="defineProps"] > TSTypeParameterInstantiation > TSTypeLiteral',
      },
    ],
    'no-else-return': ['error', { allowElseIf: false }],
    'no-lonely-if': 'error',
    'curly': 'off',
    'antfu/curly': 'error',
    'antfu/if-newline': 'error',
    'vue/require-explicit-emits': 'error',
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/no-ref-as-operand': 'error',
  },
  plugins: [storybook],
}, {
  files: ['**/*.vue'],
  plugins: {
    'vue-setup-order': vueSetupOrder,
  },
  rules: {
    'vue-setup-order/order': ['error', {
      groupBlankLines: true,
      order: [
        'import',
        'types',
        'defineProps',
        'composable',
        'ref',
        'computed',
        'watch',
        'function',
        'provide',
        'unknown',
        'onMounted',
      ],
    }],
  },
})
