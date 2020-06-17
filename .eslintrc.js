module.exports = {
  extends: 'erb/typescript',
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'no-unused-vars': 0,
    '@typescript-eslint/no-unused-vars': ["error", { "argsIgnorePattern": "^_" }],
    '@typescript-eslint/no-explicit-any': 0,
    'no-plusplus': ["error", { "allowForLoopAfterthoughts": true }],
    'react/destructuring-assignment': 0,
    'no-param-reassign': ["error", { "props": true, "ignorePropertyModificationsFor": ["draft"] }],
    'no-underscore-dangle': 0,
    'no-prototype-builtins': 0,
    'no-restricted-syntax': [ // This is a copy of the original airbnb-base definition
      'error',
      {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      }, /* We don't care about heavyweight and disallowing for-of forces using clumsy index iteration if you don't want functions due to use of await
      {
        selector: 'ForOfStatement',
        message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
      }, */
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ]
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
