import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

const ALLOWED_COMMENT = /^\s*(\/\s*<reference|eslint-|@ts-)/

const houseStyle = {
  rules: {
    'no-comments': {
      meta: {
        type: 'suggestion',
        docs: { description: 'O código do Pulse não leva comentário.' },
        schema: [],
        messages: {
          found: 'Comentário no código. Diga isso no nome ou no commit.',
        },
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (ALLOWED_COMMENT.test(comment.value)) continue
              context.report({ node: comment, messageId: 'found' })
            }
          },
        }
      },
    },
  },
}

export default tseslint.config(
  {
    ignores: ['out/**', 'build/**', 'dist/**', 'node_modules/**', '*.tsbuildinfo'],
  },

  ...tseslint.configs.recommended,

  {
    plugins: { house: houseStyle },
    rules: { 'house/no-comments': 'error' },
  },

  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts', 'shared/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'ui', pattern: 'src/shared/*', mode: 'folder' },
        { type: 'app', pattern: 'src/app', mode: 'folder' },
        {
          type: 'feature',
          pattern: 'src/features/*',
          mode: 'folder',
          capture: ['feature'],
        },
        {
          type: 'main-module',
          pattern: 'electron/modules/*',
          mode: 'folder',
          capture: ['feature'],
        },
        { type: 'main-core', pattern: 'electron/core/*', mode: 'folder' },
        { type: 'main-boot', pattern: 'electron/{bootstrap,preload}', mode: 'folder' },
        { type: 'domain', pattern: 'shared/**/*', mode: 'full' },
      ],
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.node.json', './tsconfig.web.json'],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      'boundaries/no-unknown-files': 'off',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'domain', allow: ['domain'] },
            { from: 'ui', allow: ['domain', 'ui'] },
            { from: 'feature', allow: ['domain', 'ui', 'feature'] },
            { from: 'app', allow: ['domain', 'ui', 'feature', 'app'] },
            { from: 'main-core', allow: ['domain', 'main-core'] },
            { from: 'main-module', allow: ['domain', 'main-core', 'main-module'] },
            { from: 'main-boot', allow: ['domain', 'main-core', 'main-module', 'main-boot'] },
          ],
        },
      ],
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          rules: [
            { target: ['domain'], allow: '**' },
            { target: ['ui'], allow: '**' },
            { target: ['app'], allow: '**' },
            { target: ['main-core'], allow: '**' },
            { target: ['main-boot'], allow: '**' },
            {
              target: [['feature', { feature: '${from.feature}' }]],
              allow: '**',
            },
            {
              target: [['main-module', { feature: '${from.feature}' }]],
              allow: '**',
            },
            { target: ['feature', 'main-module'], allow: 'index.ts' },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'vitest.setup.ts'],
    rules: {
      'boundaries/element-types': 'off',
      'boundaries/entry-point': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts,mjs}', 'vitest.setup.ts'],
    rules: {
      'boundaries/element-types': 'off',
      'boundaries/entry-point': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
