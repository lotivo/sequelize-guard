import js from '@eslint/js';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
// import jsdocPlugin from 'eslint-plugin-jsdoc';

export default [
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'builds/**',
      'public/**',
      'resources/**',
      'dist/**',
      '.backup/**',
      'server/graphql/schema/directives/dateDirective.js',
      'src/**/*.test.ts',
      'src/**/__tests__/**',
      'index.d.ts',
    ],
  },

  // Base configuration for all files
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.eslint.json'],
        ignores: ['dist/**', 'node_modules/**', '.nx/**'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2017,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json', './tsconfig.eslint.json'],
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
      import: importPlugin,
      // jsdoc: jsdocPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,

      // TypeScript rules - type-aware
      ...tsEslintPlugin.configs.recommended.rules,
      ...tsEslintPlugin.configs['recommended-requiring-type-checking'].rules,

      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // Import rules
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/export': 'error',
      'import/no-named-as-default': 'error',
      'import/no-named-as-default-member': 'error',
      'import/no-duplicates': 'error',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          pathGroups: [
            { pattern: '@/**', group: 'internal', position: 'before' },
          ],
          pathGroupsExcludedImportTypes: ['@'],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      'object-curly-spacing': ['error', 'always'],

      // ...jsdocPlugin.configs.recommended.rules,
    },
  },
  prettierConfig,
];
