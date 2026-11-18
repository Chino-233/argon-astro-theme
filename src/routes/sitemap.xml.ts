import type { APIRoute } from 'astro';
import { getEntries, site, terms } from '../lib/site';

export const GET: APIRoute = async () => {
  const entries = await getEntries();
  const routes = new Set(['/', ...entries.map((entry) => entry.path), ...[...terms.category, ...terms.post_tag].map((term) => term.url)]);
  const urls = [...routes].map((path) => '<url><loc>' + new URL(path, site.url).href.replaceAll('&', '&amp;') + '</loc></url>').join('');
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>',
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
