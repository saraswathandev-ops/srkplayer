module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['node_modules/', 'android/', 'dist/', '.expo/'],
  rules: {
    // Preserve the repository's existing formatting while checking correctness.
    'prettier/prettier': 'off',
    'quotes': 'off',
    'comma-dangle': 'off',
    'curly': 'off',
    // Existing cleanup debt stays visible without requiring a broad refactor.
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [{
    files: ['scripts/*.js', 'test/*.cjs'],
    parserOptions: { ecmaVersion: 2022 },
    env: { node: true, es2022: true },
    globals: { AbortSignal: 'readonly' },
  }],
};
