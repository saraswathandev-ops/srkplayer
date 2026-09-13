module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'android',
    'ios',
    'scripts',
    '*.config.js',
    '*.config.ts',
  ],
  rules: {
    'no-unused-vars': 'off',
  },
};
