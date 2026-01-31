import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import playformCompress from '@playform/compress';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  integrations: [preact({ compat: true }), playformCompress()],

  vite: { plugins: [tailwindcss()] },

  adapter: cloudflare(),
});
