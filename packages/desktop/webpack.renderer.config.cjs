const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  externalsPresets: { node: false },
  externals: {},
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'bundle.js',
    clean: true,
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    fallback: {
      events: require.resolve('events/'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      path: require.resolve('path-browserify'),
      util: require.resolve('util/'),
      fs: false,
      'fs/promises': false,
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.renderer.json',
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new webpack.DefinePlugin({
      'global': 'window',
      'global.GENTLY': false,
    }),
  ],
  devtool: 'source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/renderer'),
    },
    compress: true,
    port: Number(process.env.RENDERER_PORT) || 8081,
    hot: true,
    historyApiFallback: true,
  },
};
