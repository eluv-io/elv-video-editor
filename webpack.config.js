const webpack = require("webpack");
const Path = require("path");
const autoprefixer = require("autoprefixer");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/index.js",
  target: "web",
  output: {
    path: Path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  devServer: {
    disableHostCheck: true,
    inline: true,
    port: 8085,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "POST"
    }
  },
  resolve: {
    alias: {
      configuration: Path.join(__dirname, "configuration.json")
    }
  },
  node: {
    fs: "empty"
  },
  mode: "development",
  devtool: "source-map",
  plugins: [
    new HtmlWebpackPlugin({
      title: "Eluvio Video Editor",
      template: Path.join(__dirname, "src", "index.html"),
      inject: "body",
      cache: false,
      filename: "index.html",
      favicon: "node_modules/elv-components-js/src/icons/favicon.png"
    })
    //, new BundleAnalyzerPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              importLoaders: 2
            }
          },
          {
            loader: "postcss-loader",
            options: {
              plugins: () => [autoprefixer({})]
            }
          },
          "sass-loader"
        ]
      },
      {
        test: /\.(js|mjs)$/,
        exclude: /node_modules\/(?!elv-components-js)/,
        loader: "babel-loader",
        options: {
          presets: ['@babel/preset-env', "@babel/preset-react", "babel-preset-mobx"],
          plugins: [
            require("@babel/plugin-proposal-object-rest-spread"),
            require("@babel/plugin-transform-regenerator"),
            require("@babel/plugin-transform-runtime")
          ]
        }
      },
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader'
      },
      {
        test: /\.(gif|png|jpe?g)$/i,
        use: [
          'file-loader',
          {
            loader: 'image-webpack-loader'
          },
        ],
      },
      {
        test: /\.(txt|bin|abi)$/i,
        loader: 'raw-loader'
      }
    ]
  }
};
