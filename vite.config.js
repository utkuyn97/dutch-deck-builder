import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // expose on the LAN (e.g. to test on a phone)
    port: 5173,
  },
});
