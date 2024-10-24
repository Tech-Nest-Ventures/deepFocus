module.exports = {
  root: true, 
  env: {
    browser: true,
    es6: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'solid', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    '@electron-toolkit/eslint-config-ts/recommended',
    '@electron-toolkit/eslint-config-prettier'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowMethods: true
      }
    ],
    'no-unused-vars': ['warn', { varsIgnorePattern: '^_' }],
    // Other general rules can be added here
  },
  overrides: [
    {
      // For Solid.js-specific settings
      files: ['*.tsx'],
      extends: ['plugin:solid/typescript'],
      rules: {
        // Add or override rules specific to Solid.js or TypeScript JSX files here
      }
    }
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json'
      }
    }
  }
}
