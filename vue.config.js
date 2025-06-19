const { defineConfig } = require('@vue/cli-service');
const AutoImport = require('unplugin-auto-import/webpack').default
const Components = require('unplugin-vue-components/webpack').default
const { ElementPlusResolver } = require('unplugin-vue-components/resolvers');
const CompressionPlugin = require("compression-webpack-plugin")

module.exports = defineConfig({
  configureWebpack: {
    plugins: [
      new CompressionPlugin(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
  },
  devServer: {
    proxy: 
      {
        '/api': {
          target: process.env.VUE_APP_SITE_URL,
          secure: true,
          changeOrigin: true, // 是否改变源
          // pathRewrite: {
          //   '^/api': '',
          // },
          // logLevel: 'debug',  //开启调试日志
          // onProxyReq: (proxyReq, req, res) => {
          //   console.log(`[Proxy Request] ${req.method} ${req.url} -> ${process.env.VUE_APP_SITE_URL}${req.url}`);
          // },
          // onProxyRes: (proxyRes, req, res) => {
          //   console.log(`[Proxy Response] ${proxyRes.statusCode} ${req.url}`);
          // }
        },
        '/userConfig': {
          target: process.env.VUE_APP_SITE_URL,
          secure: true,
          changeOrigin: true, // 是否改变源
          // logLevel: 'debug',  //开启调试日志
          // onProxyReq: (proxyReq, req, res) => {
          //   console.log(`[Proxy Request] ${req.method} ${req.url} -> ${process.env.VUE_APP_SITE_URL}${req.url}`);
          // },
          // onProxyRes: (proxyRes, req, res) => {
          //   console.log(`[Proxy Response] ${proxyRes.statusCode} ${req.url}`);
          // }
        },
        '/upload': {
          target: process.env.VUE_APP_SITE_URL,
          secure: true,
          changeOrigin: true, // 是否改变源
          // logLevel: 'debug',  // 开启调试日志
          // onProxyReq: (proxyReq, req, res) => {
          //   console.log(`[Proxy Request] ${req.method} ${req.url} -> ${process.env.VUE_APP_SITE_URL}${req.url}`);
          // },
          // onProxyRes: (proxyRes, req, res) => {
          //   console.log(`[Proxy Response] ${proxyRes.statusCode} ${req.url}`);
          // }
        },
        '/file': {
          target: process.env.VUE_APP_SITE_URL,
          secure: true,
          changeOrigin: true, // 是否改变源
          // logLevel: 'debug',  // 开启调试日志
          // onProxyReq: (proxyReq, req, res) => {
          //   console.log(`[Proxy Request] ${req.method} ${req.url} -> ${process.env.VUE_APP_SITE_URL}${req.url}`);
          // },
          // onProxyRes: (proxyRes, req, res) => {
          //   console.log(`[Proxy Response] ${proxyRes.statusCode} ${req.url}`);
          // }
        },
      },
    https: false, // 是否启用https
  },
  transpileDependencies: true,
});
