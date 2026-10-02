import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@/services/videoAudioConversion', replacement: path.resolve(__dirname, './services/videoAudioConversion.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
