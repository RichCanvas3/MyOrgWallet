import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgrPlugin from 'vite-plugin-svgr';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Mock process.env for compatibility
    'process.env': {
      NODE_ENV: process.env.NODE_ENV || 'development', // Use Node's process.env as fallback
    },
    global: {},
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      stream: 'stream-browserify',
      util: 'util',
    },
  },
  plugins: [
    react(),
    viteTsconfigPaths(),
    svgrPlugin(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      define: {
        global: 'globalThis',
      },
      supported: {
        bigint: true,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Proxy API requests to the backend server
    proxy: {
      '/api': {
        target: 'http://localhost:4000',  // Your backend Express server
        changeOrigin: true,
        secure: false, // Disable SSL verification (useful in development)
        rewrite: (path) => path.replace(/^\/api/, ''), // Remove `/api` prefix
      },
      '/linkedin-callback': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/x-callback': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/shopify-callback': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist', // Output directory for the build
    chunkSizeWarningLimit: 2000, // in kilobytes
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  // Add base path for Azure if app is hosted under a subdirectory
  base: process.env.VITE_BASE_PATH || '/', // Use env var for flexibility
});
