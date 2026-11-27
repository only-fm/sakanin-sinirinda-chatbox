import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  define: {
    'import.meta.env.VITE_STANDALONE_APP': JSON.stringify('expert'),
  },
  server: {
    port: 5174,
  },
});
