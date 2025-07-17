/** @type {import('@babel/core').ConfigFunction} */
function makeConfig(api) {
  api.cache.using(() => process.env.NODE_ENV === 'development');

  return {
    // Fixes "TypeError: __webpack_require__(...) is not a function"
    // https://github.com/webpack/webpack/issues/9379#issuecomment-509628205
    // https://babel.dev/docs/options#sourcetype
    sourceType: 'unambiguous',
    // https://babel.dev/docs/assumptions
    assumptions: {
      noNewArrows: true
    },
    plugins: [
      [
        '@babel/plugin-transform-typescript',
        {
          strictMode: true
        }
      ]
    ],
    presets: [
      [
        '@babel/preset-env',
        {
          bugfixes: true,
          targets: {
            node: '8.12.0',
            chrome: '79'
          }
        }
      ]
    ]
  };
}

export default makeConfig;
