import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const root = path.resolve(import.meta.dirname)
const rootSrc = path.resolve(root, 'src')
const rootRenderer = path.resolve(root, 'src/renderer')

export default defineConfig({
  root: rootRenderer,
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({
      imports: ['vue'],
    }),
    Components({
      dirs: [`${rootRenderer}/components`],
      extensions: ['vue'],
      dts: true,
      directoryAsNamespace: true,
      collapseSamePrefixes: true,
    }),
  ],
  build: {
    outDir: path.resolve(root, 'build/web'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // KEY: redirect @/electron to the web shim
      '@/electron': path.resolve(rootRenderer, 'electron.web.ts'),
      '@': rootRenderer,
      '~': rootSrc,
    },
  },
  define: {
    'process.env': {},
    'process': {},
  },
  server: {
    port: 5174,
    proxy: {
      // Proxy API calls to standalone server during development
      '/api': {
        target: 'http://localhost:4321',
        rewrite: p => p.replace(/^\/api/, ''),
      },
    },
  },
})
