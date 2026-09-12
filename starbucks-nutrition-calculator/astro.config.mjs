import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Overridable at build time (e.g. `SITE_URL=https://yourdomain.com npm run build`, or via the
// SITE_URL repository variable in the deploy workflow) so the real domain never has to be
// hand-edited into this file before every deploy.
const site = process.env.SITE_URL || 'https://example.com';

export default defineConfig({
  site,
  integrations: [react(), sitemap()],
  output: 'static',
  compressHTML: true,
});
