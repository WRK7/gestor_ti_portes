import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5292,
    host: '0.0.0.0',
    strictPort: true,
    /** Mesma origem do front → cookie httpOnly do refresh funciona (evita 401 em /api/auth/refresh). */
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
      },
    },
  },
})
