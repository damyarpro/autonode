import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Keeps the browser on one origin, so EventSource and fetch need no CORS.
    proxy: { '/api': { target: API, changeOrigin: true, ws: false } },
  },
})
