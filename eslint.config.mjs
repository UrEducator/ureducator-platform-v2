// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', '**/.next/**', 'apps/web/out/**', 'apps/web/out-mock/**', 'functions/lib/**', 'dist/**',
      'tests/e2e/.build/**', 'tests/e2e/shots/**', '**/*.tsbuildinfo', 'apps/web/next-env.d.ts', 'coverage/**',
      'playwright-report/**', 'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['functions/**/*.ts', 'packages/**/*.ts', 'scripts/**/*.mjs', 'tests/**/*.ts', 'tests/**/*.mjs', '*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Functions log through the structured logger only.
    files: ['functions/src/**/*.ts'],
    ignores: ['functions/src/devtools/**', 'functions/src/**/__tests__/**'],
    rules: { 'no-console': 'error' },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      // Classic hooks rules are enforced. The React-Compiler-oriented rules shipped in eslint-plugin-react-hooks 7
      // (set-state-in-effect, purity, refs, immutability) are disabled: this app does not use the React Compiler, and
      // the flagged spots are deliberate (fetch-in-effect hooks, Date.now() for "is this attempt still live", the
      // exam hook's latest-value refs). They are covered by the Playwright suite, including reload, resume and timeout.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    // Node-side scripts, test harnesses and specs may print.
    files: ['scripts/**', 'tests/**', 'functions/build.mjs', 'functions/src/devtools/**', 'functions/src/**/__tests__/**'],
    rules: { 'no-console': 'off' },
  },
);
