// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

import playformCompress from '@playform/compress';

export default defineConfig({
  output: 'server',
  integrations: [preact({ compat: true }), playformCompress()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});