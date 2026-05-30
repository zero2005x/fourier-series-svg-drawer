import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split large/vendor code into separate chunks so the initial
        // bundle stays small and chunks can be cached independently.
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['motion'],
          translations: ['./src/translations.ts'],
        },
      },
    },
  },
});

