import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Supabase publishable key may be stored in Netlify under a different name.
// Vite only exposes VITE_-prefixed variables to the browser, so map known
// fallbacks onto VITE_SUPABASE_ANON_KEY. Only publishable/anon keys are accepted,
// never service-role or secret keys.
if (!process.env.VITE_SUPABASE_ANON_KEY) {
  const fallback = [
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.Database,
  ]
    .map((value) => value?.trim())
    .find((value) => value && !value.startsWith('sb_secret_') && (value.startsWith('sb_publishable_') || value.startsWith('eyJ')));
  if (fallback) process.env.VITE_SUPABASE_ANON_KEY = fallback;
}

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: {
    port: 5172,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://api:3000',
    },
  },
});
