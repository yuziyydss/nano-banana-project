import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Relax TS strictness for pragmatic development: allow `any` where necessary
      '@typescript-eslint/no-explicit-any': 'off',
      // Turn unused-vars into warnings and ignore _-prefixed args/vars
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Allow empty-object-type extensions in simple UI prop wrappers
      '@typescript-eslint/no-empty-object-type': 'off',
      // Allow using the Function type in some framework-style APIs
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  }
);
