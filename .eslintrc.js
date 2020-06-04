module.exports = {
  extends: 'erb/typescript',
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'no-unused-vars': 0,
    '@typescript-eslint/no-unused-vars': ["error", { "argsIgnorePattern": "^_" }],
    'no-plusplus': ["error", { "allowForLoopAfterthoughts": true }],
    'react/destructuring-assignment': 0
  },
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {},
      webpack: {
        config: require.resolve('./configs/webpack.config.eslint.js')
      }
    }
  }
};
