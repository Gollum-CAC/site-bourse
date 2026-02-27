import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // En production, le frontend est servi par Nginx qui proxifie /api vers le backend
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
