const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const typescriptEslint = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
])
