import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3000, host: true },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    target: 'es2022',
    // Source maps ship: a premium app still needs to be debuggable in the wild.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the vendor runtime from game code so an app update doesn't
        // invalidate React in the user's cache.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'react'
            return 'vendor'
          }
        },
      },
    },
  },
})
