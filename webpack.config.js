const webpack = require("webpack");
const Path = require("path");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const fs = require("fs");

module.exports = env => {
  const isDevelopment = !!env.WEBPACK_SERVE;

  let plugins = [
    new HtmlWebpackPlugin({
      title: "Eluvio Media Wallet",
      template: Path.join(__dirname, "src", "index.html"),
      filename: "index.html",
      favicon: Path.join(__dirname, "src", "static", "icons", "favicon.png"),
      inject: "body"
    })
  ];

  if(isDevelopment) {
    plugins.push(new ReactRefreshWebpackPlugin({overlay: false}));
  }

  if(process.env.ANALYZE_BUNDLE) {
    plugins.push(new BundleAnalyzerPlugin());
  }

  return {
    entry: "./src/index.jsx",
    output: {
      path: Path.resolve(__dirname, "dist"),
      publicPath: "/",
      clean: true,
      filename: "main.js",
      chunkFilename: "bundle.[id].[chunkhash].js"
    },
    snapshot: {
      managedPaths: [],
    },
    watchOptions: {
      followSymlinks: true,
    },
    devServer: {
      hot: true,
      client: {
        //webSocketURL: "auto://elv-test.io/ws",
        overlay: false,
        logging: "verbose"
      },
      historyApiFallback: true,
      allowedHosts: "all",
      port: 8083,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Allow-Methods": "POST"
      },
      // This is to allow configuration.js to be accessed
      static: {
        directory: Path.resolve(__dirname, "./config"),
        publicPath: "/"
      }
    },
    resolve: {
      alias: {
        Assets: Path.resolve(__dirname, "src/static"),
        Components: Path.resolve(__dirname, "src/components"),
        Routes: Path.resolve(__dirname, "src/routes"),
        Stores: Path.resolve(__dirname, "src/stores"),
        Utils: Path.resolve(__dirname, "src/utils"),
        Workers: Path.resolve(__dirname, "src/Workers"),
        configuration: Path.join(__dirname, "configuration.json")
      },
      fallback: {
        stream: require.resolve("stream-browserify"),
        url: require.resolve("url")
      },
      extensions: [".js", ".jsx", ".mjs", ".scss", ".png", ".svg"]
    },
    mode: "development",
    devtool: "eval-source-map",
    plugins,
    externals: {
      crypto: "crypto"
    },
    module: {
      rules: [
        {
          test: /\.(theme|font)\.(css|scss)$/i,
          type: "asset/source"
        },
        {
          test: /\.(css|scss)$/,
          exclude: /\.(theme|font)\.(css|scss)$/i,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                importLoaders: 2,
                modules: {
                  mode: "local",
                  auto: true,
                  localIdentName: isDevelopment ?  "[local]--[hash:base64:5]" : "[hash:base64:5]"
                }
              }
            },
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: {
                    "postcss-preset-mantine": {},
                    "postcss-simple-vars": {
                      variables: {
                        "mantine-breakpoint-xs": "36em",
                        "mantine-breakpoint-sm": "48em",
                        "mantine-breakpoint-md": "62em",
                        "mantine-breakpoint-lg": "75em",
                        "mantine-breakpoint-xl": "88em",
                      },
                    },
                  }
                }
              }
            },
            "sass-loader"
          ]
        },
        {
          test: /\.(js|mjs|jsx)$/,
          loader: "babel-loader",
          options: {
            plugins: [
              isDevelopment && require.resolve("react-refresh/babel")
            ].filter(Boolean),
            presets: [
              "@babel/preset-env",
              "@babel/preset-react"
            ]
          }
        },
        {
          test: /\.svg$/,
          loader: "svg-inline-loader"
        },
        {
          test: /\.(gif|png|jpe?g|otf|woff2?|ttf)$/i,
          include: [Path.resolve(__dirname, "src/static/public")],
          type: "asset/inline",
          generator: {
            filename: "public/[name][ext]"
          }
        },
        {
          test: /\.(gif|png|jpe?g|otf|woff2?|ttf)$/i,
          type: "asset/resource",
        },
        {
          test: /\.(txt|bin|abi)$/i,
          type: "asset/source"
        },
        {
          test: /\.ya?ml$/,
          use: "yaml-loader"
        }

        /*

        {
          test: /\.(js|mjs)$/,
          exclude: /node_modules\/(?!elv-components-js)/,
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react", "babel-preset-mobx"],
            plugins: [
              ["@babel/plugin-proposal-decorators", {"version": "legacy"}],
              require("@babel/plugin-proposal-object-rest-spread"),
              require("@babel/plugin-transform-regenerator"),
              require("@babel/plugin-transform-runtime"),
              ["@babel/plugin-proposal-private-methods", {loose: true}],
              ["@babel/plugin-proposal-private-property-in-object", {"loose": true}]
            ]
          }
        },


         */
      ]
    }
  };
};

