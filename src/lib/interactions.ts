import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AstroCookies } from 'astro';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { stateDir } from './argon-state';
import type { Comment, Entry } from './types';
import emotions from './comment-emotions.json';

export type CommentRevision = { html: string; source: string; date: string };
export type StoredComment = Comment & {
  status: 'pending' | 'approved';
  visitor?: string;
  source?: string;
  revision?: CommentRevision;
  history?: CommentRevision[];
  editedAt?: string;
  email?: string;
  mailToken?: string;
  mailVerified?: boolean;
};
export type Interactions = {
  comments: StoredComment[];
  likes: Record<string, number>;
  commentVotes?: Record<string, string[]>;
  pinnedComments?: Record<string, number[]>;
  lastCommentId?: number;
};

let cached: Promise<Interactions> | undefined;
let queue = Promise.resolve();

export function loadInteractions() {
  if (!cached) {
    const pending = readFile(resolve(stateDir(), 'interactions.json'), 'utf8')
      .then((body) => JSON.parse(body) as Interactions)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return { comments: [], likes: {} };
        throw error;
      });
    cached = pending;
    void pending.catch(() => { if (cached === pending) cached = undefined; });
  }
  return cached;
}

export function publicComments(data: Interactions) {
  return data.comments.filter((comment) => comment.status === 'approved' && !comment.ownerOnly);
}

const visitorCookie = 'argon_comment_visitor';

export function commentVisitor(cookies: AstroCookies, url?: URL) {
  let token = cookies.get(visitorCookie)?.value ?? '';
  if (!/^[\da-f]{64}$/u.test(token)) {
    if (!url) return undefined;
    token = randomBytes(32).toString('hex');
    cookies.set(visitorCookie, token, {
      httpOnly: true, sameSite: 'lax', secure: !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
      path: '/', maxAge: 365 * 86400,
    });
  }
  return createHash('sha256').update(token).digest('hex');
}

export function ownsComment(comment: StoredComment | undefined, visitor?: string) {
  return Boolean(visitor && comment?.visitor === visitor);
}

export function commentPins(data: Interactions, postId: Entry['id'], items: Comment[]) {
  return data.pinnedComments?.[String(postId)] ?? items.filter((item) => item.post_id === postId && item.pinned).map((item) => item.id);
}

export function allowsComments(entry: Entry) {
  return !entry.visibility && (entry.type === 'post' || entry.type === 'shuoshuo' || entry.template === 'msgboard.php');
}

export function updateInteractions<T>(update: (state: Interactions) => T) {
  const job = queue.then(async () => {
    const next = structuredClone(await loadInteractions());
    const result = update(next);
    const dir = stateDir();
    const temp = resolve(dir, 'interactions.' + randomUUID() + '.tmp');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    try { await rename(temp, resolve(dir, 'interactions.json')); }
    finally { await unlink(temp).catch(() => {}); }
    cached = Promise.resolve(next);
    return result;
  });
  queue = job.then(() => {}, () => {});
  return job;
}

export function textToComment(text: string) {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return text.split(/\r?\n\s*\r?\n/).map((paragraph) => '<p>' + escape(paragraph).replace(/\r?\n/g, '<br />') + '</p>').join('');
}

const stickers: Record<string, string> = emotions.stickers;

export function renderComment(text: string, markdown: boolean, stickersEnabled: boolean) {
  const html = markdown
    ? sanitizeHtml(marked.parse(text, { async: false, breaks: true }), {
      allowedTags: sanitizeHtml.defaults.allowedTags,
      allowedAttributes: { a: ['href'] },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowProtocolRelative: false,
      transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'ugc nofollow' }) },
    })
    : textToComment(text);
  if (!stickersEnabled) return html;
  // Replace codes in text nodes only. Sticker sources come from the bundled manifest.
  return html.split(/(<[^>]+>)/g).map((segment, index) => index % 2 ? segment : segment.replace(
    /\[sticker:([\w-]+)\]/g,
    (token, name) => Object.hasOwn(stickers, name)
      ? '<img class="astro-comment-sticker" loading="lazy" src="/assets/argon/stickers/' + stickers[name] + '" alt="' + name + '" />'
      : token,
  )).join('');
}

export function commentDevice(agent: string): Comment['device'] {
  const browser = /\b(Edg|Firefox|Chrome|Version)\/(\d+)/.exec(agent);
  const names: Record<string, string> = { Edg: 'Edge', Firefox: 'Firefox', Chrome: 'Chrome', Version: 'Safari' };
  // Edge identifies itself as Chrome earlier in the user agent.
  const edge = /\bEdg\/(\d+)/.exec(agent);
  return {
    browser: edge ? 'Edge' : browser ? names[browser[1]] : undefined,
    version: edge?.[1] ?? browser?.[2],
    platform: /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS' : /Windows/.test(agent) ? 'Windows'
      : /Macintosh/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : undefined,
  };
}
