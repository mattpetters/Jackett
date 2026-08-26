import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const uiDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(uiDirectory, 'src'),
    },
  },
  build: {
    outDir: path.resolve(uiDirectory, '../Jackett.Common/Content/UI'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:9117',
      '/UI': 'http://127.0.0.1:9117',
    },
  },
})
