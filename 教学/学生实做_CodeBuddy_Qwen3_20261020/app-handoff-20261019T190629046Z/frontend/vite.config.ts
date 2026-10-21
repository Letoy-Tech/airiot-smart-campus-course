import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1', port: 5178, strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8091', changeOrigin: false } },
  },
  test: { environment: 'jsdom', clearMocks: true, restoreMocks: true },
})
