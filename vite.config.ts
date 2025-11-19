import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Using relative base path ensures assets load correctly on GitHub Pages
  // regardless of the repository name.
  base: './',
  build: {
    target: 'esnext', // Important for Top Level Await and modern PDF.js support
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          xlsx: ['xlsx'],
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
