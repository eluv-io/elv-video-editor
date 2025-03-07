import { defineConfig } from "vite";
import { fileURLToPath, URL } from "url";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react-swc";
import ViteYaml from "@modyfi/vite-plugin-yaml";

export default defineConfig(() => {
  let plugins = [
    react(),
    ViteYaml(),
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
        "@/workers": fileURLToPath(new URL("./src/utils", import.meta.url)),
        "@tabler/icons-react": "@tabler/icons-react/dist/esm/icons/index.mjs",
      }
    },
    build: {
      manifest: true
    }
  };
});
