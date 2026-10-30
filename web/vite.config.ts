// The web app's dev server. It forwards /api to the API, and may read the shared code in ../src, where the
// formatting and the types the app uses are defined once.

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = Number(process.env.API_PORT) || 3001;

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${apiPort}` },
    fs: { allow: ['..'] },
  },
});
