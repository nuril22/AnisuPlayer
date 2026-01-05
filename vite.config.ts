import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward cookies
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
        }
      },
      '/storage': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
      // Note: /cdn route is NOT proxied here
      // React Router handles /cdn/:id page routes
      // API calls from VideoPlayerPage will use full backend URL in development
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
