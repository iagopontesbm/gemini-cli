import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Standard port for React dev server
    proxy: {
      // Proxy API requests to the backend server
      // This avoids CORS issues during development
      '/api': {
        target: 'http://localhost:3001', // Assuming backend runs on port 3001
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // Uncomment if backend doesn't expect /api prefix
      }
    }
  }
})
