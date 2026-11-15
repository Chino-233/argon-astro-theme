import { randomInt } from 'node:crypto';
import type { Entry } from './types';

type ReadOption = (key: string, fallback?: string) => string;

const cdn = {
  jsdelivr: 'https://cdn.jsdelivr.net/gh/solstice23/argon-theme@1.3.5',
  jsdelivr_gcore: 'https://gcore.jsdelivr.net/gh/solstice23/argon-theme@1.3.5',
  jsdelivr_fastly: 'https://fastly.jsdelivr.net/gh/solstice23/argon-theme@1.3.5',
  jsdelivr_cf: 'https://testingcf.jsdelivr.net/gh/solstice23/argon-theme@1.3.5',
  fastgit: 'https://raw.fastgit.org/solstice23/argon-theme/v1.3.5',
  sourcegcdn: 'https://gh.sourcegcdn.com/solstice23/argon-theme/v1.3.5',
};

export function argonAssets(option: ReadOption) {
  const mode = option('assets_path', 'default');
  const base = mode === 'custom' ? option('custom_assets_path').replaceAll('%theme_version%', '1.3.5') : cdn[mode as keyof typeof cdn];
  const url = base?.replace(/\/$/, '');
  return {
    stylesheet: url ? url + '/style.css' : '/assets/argon/style.css',
    asset: (name: string) => url ? url + '/assets/' + name : '/assets/argon/' + name,
  };
}

let daily: { expires: number; result: Promise<string> } | undefined;

export function bannerBackground(value: string): string | Promise<string> {
  if (value !== '--bing--') return value;
  if (!daily || daily.expires < Date.now()) {
    const result = fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1', { signal: AbortSignal.timeout(3500) })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const path = data?.images?.[0]?.url;
        return typeof path === 'string' && /^\/th\?/.test(path) ? new URL(path, 'https://www.bing.com').href : '';
      }).catch(() => '');
    daily = { expires: Date.now() + 3600_000, result };
    void result.then((image) => { if (!image && daily?.result === result) daily.expires = Date.now() + 60_000; });
  }
  return daily.result;
}

export function relatedArticles(entry: Entry, articles: Entry[], option: ReadOption) {
  const mode = option('related_post', 'disabled');
  if (entry.type !== 'post' || mode === 'disabled') return [];
  const candidates = articles.filter((item) => item.id !== entry.id && !item.visibility && (
    (mode.includes('category') && item.categories?.some((id) => entry.categories?.includes(id))) ||
    (mode.includes('tag') && item.tags?.some((id) => entry.tags?.includes(id)))
  ));
  const limit = Number(option('related_post_limit', '10'));
  const orderBy = option('related_post_sort_orderby', 'date');
  if (orderBy === 'rand') {
    for (let i = candidates.length - 1; i > 0; i--) {
      const index = randomInt(i + 1);
      [candidates[i], candidates[index]] = [candidates[index], candidates[i]];
    }
    return candidates.slice(0, limit);
  }
  const keys: Record<string, (item: Entry) => string | number> = {
    date: (item) => Date.parse(item.published),
    modified: (item) => Date.parse(item.updated ?? item.published),
    meta_value_num: (item) => Number(String(item.views ?? '0').replaceAll(',', '')) || 0,
    ID: (item) => item.id,
    title: (item) => item.title,
    author: (item) => item.author ?? '',
  };
  const key = keys[orderBy] ?? keys.date;
  const direction = option('related_post_sort_order', 'DESC') === 'ASC' ? 1 : -1;
  return candidates.sort((a, b) => {
    const first = key(a);
    const second = key(b);
    return direction * (typeof first === 'number' && typeof second === 'number'
      ? first - second : String(first).localeCompare(String(second), 'zh-Hans', { numeric: true }));
  }).slice(0, limit);
}

export function excerptLength(text: string, limit: number) {
  if (!limit) return '';
  const units = text.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu);
  let count = 0;
  for (const unit of units) if (++count > limit) return text.slice(0, unit.index).trimEnd() + '…';
  return text;
}

export function firstImage(entry: Entry, option: ReadOption) {
  if (entry.featuredImage || entry.visibility || option('first_image_as_thumbnail_by_default') !== 'true') return entry.featuredImage;
  const url = /<img\b[^>]*\s(?:src|data-src)=["']([^"']+)["']/i.exec(entry.html)?.[1]
    ?? /!\[[^\]]*\]\(([^)\s]+)\)/.exec(entry.html)?.[1];
  return url && /^(?:\/(?!\/)|https?:\/\/)/i.test(url) ? url.replaceAll('&amp;', '&') : undefined;
}
