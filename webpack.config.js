import CopyPlugin from 'copy-webpack-plugin';

/** @type {(env: Record<string, string>, argv: { mode?: string }) => (import('webpack').Configuration)[]} */
const makeConfig = (_env, argv) => [
  {
    /**
     * NOTE: Using inline-source-map for development builds for best webOS compatibility.
     */
    devtool: argv.mode === 'development' ? 'inline-source-map' : 'source-map',

    target: ['web', 'es2017'],

    entry: {
      index: './src/index.js',
      userScript: {
        import: './src/userScript.js',
        filename: 'webOSUserScripts/[name].js'
      }
    },

    resolve: {
      extensions: ['.mjs', '.cjs', '.js', '.json', '.ts']
    },

    module: {
      rules: [
        {
          test: /\.[mc]?[jt]s$/i,

          loader: 'babel-loader',
          exclude: [
            // Some module should not be transpiled by Babel
            // See https://github.com/zloirock/core-js/issues/743#issuecomment-572074215
            // \\ for Windows, / for macOS and Linux
            /node_modules[\\/]core-js/,
            /node_modules[\\/]webpack[\\/]buildin/
          ],
          options: {
            cacheDirectory: true
          },
          resolve: {
            // File extension DON'T MATTER in a bundler.
            fullySpecified: false
          }
        },
        {
          test: /\.css$/i,
          use: [
            { loader: 'style-loader' },
            {
              loader: 'css-loader',
              options: { esModule: false, importLoaders: 1 }
            },
            'postcss-loader'
          ]
        },
        {
          test: /\.(png|jpg|gif|svg)$/i,
          type: 'asset/inline'
        }
      ]
    },

    plugins: [
      new CopyPlugin({
        patterns: [
          { context: 'assets', from: '**/*' },
          { context: 'src', from: 'index.html' }
        ]
      })
    ]
  }
];

export default makeConfig;
