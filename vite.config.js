import { defineConfig, splitVendorChunkPlugin } from "vite";
import { fileURLToPath, URL } from "url";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(() => {
  let plugins = [
    react(),
    splitVendorChunkPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: "configuration.js",
          dest: ""
        }
      ]
    })
  ];

  return {
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler"
        }
      }
    },
    plugins,
    server: {
      port: 8083,
      host: true
    },
    resolve: {
      // Synchronize with jsonconfig.json
      alias: {
        "@/assets": fileURLToPath(new URL("./src/assets", import.meta.url)),
        "@/components": fileURLToPath(new URL("./src/components", import.meta.url)),
        "@/stores": fileURLToPath(new URL("./src/stores", import.meta.url)),
        "@/utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
        "@/workers": fileURLToPath(new URL("./src/utils", import.meta.url))
      }
    },
    build: {
      manifest: true
    }
  };
});
