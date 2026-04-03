const next = require('eslint-config-next');

module.exports = [
  {
    ignores: ['.next/**', '.next_build/**', 'node_modules/**'],
  },
  ...next,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
];
