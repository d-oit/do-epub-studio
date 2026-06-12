import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import unicorn from 'eslint-plugin-unicorn';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';
import importPlugin from 'eslint-plugin-import-x';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '.turbo/',
      'apps/*/.turbo/**',
      'packages/*/.turbo/**',
      '*.min.js',
      '.wrangler/',
      // Wrangler-generated runtime type definitions — content is auto-managed.
      'apps/worker/src/worker-configuration.d.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-compiler': reactCompiler,
      'jsx-a11y': jsxA11y,
      unicorn,
      promise,
      security,
      import: importPlugin,
    },
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-useless-assignment': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-compiler/react-compiler': 'warn',
      // eslint-plugin-react: only keeping rules that TypeScript can't catch
      'react/jsx-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
      'jsx-a11y/no-redundant-roles': 'error',
      'unicorn/filename-case': [
        'error',
        {
          cases: {
            camelCase: true,
            pascalCase: true,
            kebabCase: true,
          },
          // __stories__ is a Storybook convention; __tests__ is Jest/Vitest convention
          ignore: [/^__stories__$/, /^__tests__$/],
        },
      ],
      'unicorn/prefer-optional-catch-binding': 'error',
      // Prefer explicit naming; abbreviations are common in this codebase
      'unicorn/prevent-abbreviations': 'off',
      'promise/catch-or-return': 'warn',
      'promise/no-return-wrap': 'error',
      // Object injection: off for source (TypeScript provides static safety);
      // use Object.hasOwn() guard for dynamic keys from untrusted input
      'security/detect-object-injection': 'off',
      // Handled by Prettier for consistent formatting
      'import/order': 'off',
      // .exec() is more explicit and doesn't cause false positives with global regex state
      '@typescript-eslint/prefer-regexp-exec': 'off',
      // Logical OR (||) is idiomatic and preferred for default values in this codebase
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true, ignoreVoidOperator: true }],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
    },
  },
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/tests/**',
      '**/__tests__/**',
      'scripts/**',
      '*.config.{js,ts,mjs}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  prettierConfig,
);
