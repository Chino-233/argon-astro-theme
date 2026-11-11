import { getCollection } from 'astro:content';
import data from '../data/site.json';
import imported from '../data/posts.json';
import history from '../data/comments.json';
import type { Comment, Entry, MenuItem, Term } from './types';

export const site = data.site as typeof data.site & { started_at?: string };
export const theme = data.argon as Record<string, string | boolean | number>;
export const menus = data.menus as Record<string, MenuItem[]>;
export const terms = data.terms as Record<'category' | 'post_tag', Term[]>;
export const customCss = data.customCss;
export const comments = history as Comment[];

export function option(name: string, fallback = '') {
  const value = theme['argon_' + name];
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

export function canonicalPath(path: string) {
  try {
    return decodeURIComponent(path).replace(/\/+$/, '') + '/';
  } catch {
    return path.replace(/\/+$/, '') + '/';
  }
}

export function stripTags(markup: string) {
  return markup.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|hellip);/g, ' ').replace(/\s+/g, ' ').trim();
}

export function safeLink(value: string) {
  if (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value) || value.startsWith('#')) return value;
  return '#';
}

export function stamp(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: site.timezone, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? '';
  return { year: part('year'), month: part('month'), day: part('day'), time: part('hour') + ':' + part('minute') };
}

export function ordered(entries: Entry[]) {
  return [...entries].sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

export async function getEntries() {
  const markdown = await getCollection('posts');
  const posts: Entry[] = markdown.map(({ id, data, body }) => ({
    id, type: data.type, title: data.title, path: data.path,
    published: data.date.toISOString(), updated: data.updated?.toISOString(),
    excerpt: data.excerpt ?? '', featuredImage: data.featuredImage ?? '',
    categories: data.categories, tags: data.tags, html: body ?? '',
  }));
  const entries = ordered([...(imported as Entry[]), ...posts]);
  if (new Set(entries.map((entry) => canonicalPath(entry.path))).size !== entries.length) {
    throw new Error('Two published entries have the same URL.');
  }
  return entries;
}

export function articleStats(entry: Entry) {
  const clean = stripTags(entry.html.replace(/<pre[\s\S]*?<\/pre>/gi, ' '));
  const han = clean.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
  const words = clean.match(/\b[\w]+(?:[-’'][\w]+)*\b/g)?.length ?? 0;
  return { words: han + words, minutes: Math.max(1, Math.ceil(han / 290 + words / 200)) };
}

export function headings(markup: string, prefix: string) {
  const links: Array<{ id: string; label: string; depth: number }> = [];
  const taken = new Set<string>();
  const html = markup.replace(/<h([1-5])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (_, depth, attrs: string, inner: string) => {
      const oldId = attrs.match(/\bid="([^"]+)"/)?.[1];
      const id = oldId ?? (prefix + '-' + (links.length + 1));
      if (!taken.has(id)) links.push({ id, label: stripTags(inner), depth: Number(depth) });
      taken.add(id);
      return '<h' + depth + attrs + (oldId ? '' : ' id="' + id + '"') + '>' + inner + '</h' + depth + '>';
    });
  return { html, links };
}
