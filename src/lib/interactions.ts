import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stateDir } from './argon-state';
import type { Comment, Entry } from './types';

type StoredComment = Comment & { status: 'pending' | 'approved' };
type Interactions = { comments: StoredComment[]; likes: Record<string, number> };

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
  return data.comments.filter((comment) => comment.status === 'approved');
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
