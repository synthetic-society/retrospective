// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});
