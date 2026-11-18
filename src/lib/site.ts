import { getCollection } from 'astro:content';
import { decodeHTML } from 'entities';
import data from '../data/site.json';
import imported from '../data/posts.json';
import history from '../data/comments.json';
import type { Bookmark, Comment, Entry, Heading, MenuItem, Term } from './types';
import { option as selectOption } from './argon-options';
import { editorialChanges, publishedEditorialEntry } from './editor-store';

export const site = data.site as typeof data.site & { started_at?: string };
export const theme = data.argon as Record<string, string | boolean | number>;
export const menus = data.menus as Record<string, MenuItem[]>;
export const terms = data.terms as Record<'category' | 'post_tag', Term[]>;
export const customCss = data.customCss;
export const comments = history as Comment[];
const contentSettings = data as typeof data & { bookmarks?: Bookmark[]; searchTypes?: Record<string, string> };
export const bookmarks = contentSettings.bookmarks ?? [];
export const searchTypes = contentSettings.searchTypes ?? {};

export function siteOptions(overrides: Record<string, string>) {
  return (name: string, fallback = '') => selectOption(overrides, theme, name, fallback);
}

export function canonicalPath(path: string) {
  try {
    return decodeURIComponent(path).replace(/\/+$/, '') + '/';
  } catch {
    return path.replace(/\/+$/, '') + '/';
  }
}

export function stripTags(markup: string) {
  return decodeHTML(markup.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function safeLink(value: string) {
  if (/[\\\u0000-\u001f]/u.test(value)) return '#';
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

export async function originalEntries() {
  const markdown = await getCollection('posts');
  const posts: Entry[] = markdown.map(({ id, data, body }) => ({
    id, type: data.type, title: data.title, path: data.path,
    searchType: data.searchType, template: data.template, linkStyle: data.linkStyle,
    published: data.date.toISOString(), updated: data.updated?.toISOString(),
    excerpt: data.excerpt ?? '', featuredImage: data.featuredImage ?? '',
    categories: data.categories, tags: data.tags, html: body ?? '', sourceFormat: 'markdown',
  }));
  return ordered([...(imported as Entry[]), ...posts]);
}

export async function getEntries(edits = editorialChanges()) {
  const originals = await originalEntries();
  const entries = ordered([
    ...originals.filter((entry) => !edits.has(String(entry.id))),
    ...[...edits.values()].map(publishedEditorialEntry).filter((entry): entry is Entry => !!entry && !entry.visibility),
  ]);
  if (new Set(entries.map((entry) => canonicalPath(entry.path))).size !== entries.length) {
    throw new Error('Two published entries have the same URL.');
  }
  return entries;
}

export function articleStats(entry: Entry, [hanSpeed, wordSpeed, codeSpeed]: readonly [number, number, number]) {
  let codeLines = 0;
  const clean = stripTags(entry.html.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, code: string) => {
    codeLines += code.trim().split(/\r?\n/).filter(Boolean).length;
    return ' ';
  }));
  const han = clean.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
  const words = clean.match(/\b[\w]+(?:[-’'][\w]+)*\b/g)?.length ?? 0;
  return { words: han + words + codeLines, minutes: han / hanSpeed + words / wordSpeed + codeLines / codeSpeed };
}

export function headings(markup: string, prefix: string) {
  const links: Heading[] = [];
  const taken = new Set<string>();
  const html = markup.replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (_, depth, attrs: string, inner: string) => {
      const idAttr = attrs.match(/\s+id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/i);
      const oldId = idAttr?.[1] || idAttr?.[2] || idAttr?.[3];
      const id = oldId ?? (prefix + '-' + (links.length + 1));
      if (!taken.has(id)) links.push({ id, label: stripTags(inner), depth: Number(depth) });
      taken.add(id);
      return '<h' + depth + (oldId ? attrs : attrs.replace(idAttr?.[0] ?? '', '') + ' id="' + id + '"') + '>' + inner + '</h' + depth + '>';
    });
  return { html, links };
}
