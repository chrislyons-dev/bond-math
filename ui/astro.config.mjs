import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// HTTPS configuration for local development
const certPath = path.resolve(__dirname, 'certs', 'localhost-cert.pem');
const keyPath = path.resolve(__dirname, 'certs', 'localhost-key.pem');

const httpsConfig =
  fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : false;

// https://astro.build/config
export default defineConfig({
  site: 'https://bondmath.chrislyons.dev',
  server: {
    port: 4321,
    host: true, // Listen on all addresses including LAN
  },
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false, // We'll use our own base styles
    }),
  ],
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    server: httpsConfig
      ? {
          https: httpsConfig,
          port: 4321,
          strictPort: true, // Fail if port 4321 is not available
        }
      : {
          port: 4321,
          strictPort: true,
        },
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@layouts': '/src/layouts',
        '@lib': '/src/lib',
      },
    },
  },
});
