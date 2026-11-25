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
    // Vite reloads the page when it finds a dependency after startup, and that can break hydration
    optimizeDeps: {
      include: [
        '@preact/signals',
        '@tanstack/react-query',
        'astro/virtual-modules/transitions-events.js',
        'astro/virtual-modules/transitions-router.js',
        'astro/virtual-modules/transitions-swap-functions.js',
        'astro/virtual-modules/transitions-types.js',
      ],
    },
    ssr: { optimizeDeps: { include: ['valibot', '@astrojs/preact/server.js'] } },
    plugins: [
      tailwindcss(),
      ...(process.env.ANALYZE ? [visualizer({ open: true, gzipSize: true, filename: 'stats.html' })] : []),
    ],
  },

  adapter: cloudflare(),
});
