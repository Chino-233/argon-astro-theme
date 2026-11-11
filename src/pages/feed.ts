import type { APIRoute } from 'astro';
import { getEntries, site, stripTags } from '../lib/site';

const xml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export const GET: APIRoute = async () => {
  const posts = (await getEntries()).filter((post) => post.type !== 'page');
  const items = posts.map((post) => {
    const url = xml(new URL(post.path, site.url).href);
    return '<item><title>' + xml(post.title) + '</title><link>' + url + '</link><guid>' + url + '</guid><pubDate>' +
      new Date(post.published).toUTCString() + '</pubDate><description>' + xml(stripTags(post.excerpt || post.html)) + '</description></item>';
  }).join('');
  return new Response('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>' +
    xml(site.title) + '</title><link>' + xml(site.url) + '</link><description>' + xml(site.description) + '</description>' + items + '</channel></rss>',
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
