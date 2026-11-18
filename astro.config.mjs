import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { readFileSync } from 'node:fs';
import argonTheme from './integration.mjs';
import argonAdmin from './src/admin/integration.mjs';

const { site } = JSON.parse(readFileSync(new URL('./src/data/site.json', import.meta.url), 'utf8'));
const origin = new URL(site.url);

export default defineConfig({
  site: site.url,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [argonTheme(), ...(process.env.ARGON_ENABLE_ADMIN === 'false' ? [] : [argonAdmin()])],
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  security: {
    allowedDomains: [
      { hostname: origin.hostname },
      { hostname: 'localhost' },
      { hostname: '127.0.0.1' },
      { hostname: '[::1]' },
    ],
  },
  markdown: { syntaxHighlight: false },
});
