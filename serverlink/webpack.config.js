const path = require('path');
const mode = process.env.NODE_ENV || 'development';
const HtmlWebpackPlugin = require('html-webpack-plugin');
const PugPlugin = require('pug-plugin');

module.exports = {
  entry: ['babel-polyfill', './public/index.js'],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: ""
  },
  plugins: [
    new HtmlWebpackPlugin({
    template: './public/index.html'
    }),
    new PugPlugin()
  ],
  devtool: (mode === 'development') ? 'inline-source-map' : false,
  mode: mode,
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.pug$/,
        loader: PugPlugin.loader, // the pug-plugin already contain this pug-loader
        options: {
          method: 'render', // the fastest method to generate HTML files
        }
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          "sass-loader",
        ],
      }
    ],
  },
};