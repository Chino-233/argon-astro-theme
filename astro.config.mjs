import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { readFileSync } from 'node:fs';

const { site } = JSON.parse(readFileSync(new URL('./src/data/site.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: site.url,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
});
