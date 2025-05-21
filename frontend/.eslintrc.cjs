module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  ignorePatterns: ['vite.config.ts'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended', // This enables the React hooks rules
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    'react-hooks',
    '@typescript-eslint',
    'react-refresh'
  ],
  rules: {
    // React Hooks specific rules
    'react-hooks/rules-of-hooks': 'error', // Checks rules of Hooks
    'react-hooks/exhaustive-deps': 'warn', // Checks effect dependencies
    
    // Other recommended rules
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
