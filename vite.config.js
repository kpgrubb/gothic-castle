import { defineConfig } from 'vite';

// PS1-style castle. Fixed port so the Playwright verification loop has a stable URL.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
});
