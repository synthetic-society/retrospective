import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import playformCompress from '@playform/compress';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  output: 'server',
  // CSS: we disable @playform/compress's csso pass, which strips Tailwind 4.3+
  // modern range media queries (`@media (width >= 48rem)`).
  integrations: [preact({ compat: true }), playformCompress({ CSS: false })],

  vite: {
    optimizeDeps: {
      include: ['@preact/signals', '@tanstack/react-query'],
    },
    plugins: [
      tailwindcss(),
      ...(process.env.ANALYZE ? [visualizer({ open: true, gzipSize: true, filename: 'stats.html' })] : []),
    ],
  },

  adapter: cloudflare(),
});
