import { defineConfig, configDefaults } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The lazily loaded player chunk is mostly hls.js (~590 kB); it only downloads on first play.
  build: { chunkSizeWarningLimit: 650 },
  // mobile_app has its own Jest suite.
  test: { exclude: [...configDefaults.exclude, 'mobile_app/**'] },
})
