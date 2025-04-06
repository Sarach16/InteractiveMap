// vite.config.js
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 3000
  }
});
