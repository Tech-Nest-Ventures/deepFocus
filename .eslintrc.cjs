module.exports = {
  plugins: ['solid'],
  extends: [
    'eslint:recommended',
    'plugin:solid/typescript',
    '@electron-toolkit/eslint-config-ts/recommended',
    '@electron-toolkit/eslint-config-prettier'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: true, // Allow return types to be inferred for expressions
        allowTypedFunctionExpressions: true, // Allow typed function expressions
        allowMethods: true // Allow methods in classes to omit return types
      }
    ],
    // Disable the no-unused-vars rule or allow specific patterns like unused state variables
    'no-unused-vars': ['warn', { varsIgnorePattern: '^_' }]
  }
}
