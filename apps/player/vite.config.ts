import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Player is served under /player so it can share the domain with the mgmt app.
export default defineConfig({
  base: '/player/',
  plugins: [react()],
  server: { port: 5174, host: true },
});
