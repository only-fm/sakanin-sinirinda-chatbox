import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_STANDALONE_APP': JSON.stringify('student'),
  },
  server: {
    proxy: {
      '/api': 'http://api:3000',
    },
  },
});
