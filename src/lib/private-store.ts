import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { AstroCookies } from 'astro';
import type { Comment, Entry } from './types';
import { canRead, isOwner } from './auth';
import { canonicalPath } from './site';
import { editorialChanges, publishedEditorialEntry } from './editor-store';

interface RestrictedData { posts: Entry[]; comments: Comment[] }

function root() {
  const value = process.env.ARGON_PRIVATE_CONTENT_DIR;
  return value ? resolve(value) : null;
}

export async function originalRestrictedData(): Promise<RestrictedData> {
  const dir = root();
  if (!dir) return { posts: [], comments: [] };
  return JSON.parse(await readFile(resolve(dir, 'entries.json'), 'utf-8')) as RestrictedData;
}

export async function restrictedData(edits = editorialChanges()): Promise<RestrictedData> {
  const data = await originalRestrictedData();
  return {
    posts: [
      ...data.posts.filter((entry) => !edits.has(String(entry.id))),
      ...[...edits.values()].map(publishedEditorialEntry).filter((entry): entry is Entry => !!entry && !!entry.visibility),
    ],
    comments: data.comments,
  };
}

export function findRestricted(data: RestrictedData, route: string, legacyId: string | null) {
  return data.posts.find((post) =>
    canonicalPath(post.path) === route || (legacyId && String(post.id) === legacyId));
}

export async function locateMedia(scope: string, file: string, cookies: AstroCookies) {
  const dir = root();
  if (!dir) return null;
  const data = await restrictedData();
  const comment = scope.startsWith('comment-')
    ? data.comments.find((item) => 'comment-' + item.id === scope)
    : undefined;
  const entry = data.posts.find((post) => String(post.id) === String(comment?.post_id ?? scope));
  if (comment ? !isOwner(cookies) && (comment.ownerOnly || !entry || !canRead(entry, cookies))
              : !entry || !canRead(entry, cookies)) return null;
  const allowed = comment?.media ?? entry?.media ?? [];
  const names = [file];
  try { names.push(decodeURIComponent(file)); } catch { /* Astro may already have decoded the route. */ }
  const name = names.find((candidate) => allowed.includes(candidate));
  if (!name || name.split('/').some((part) => !part || part === '..' || part === '.' || /[:\\]/.test(part))) return null;
  try {
    const base = await realpath(resolve(dir, 'uploads'));
    const target = await realpath(resolve(base, name));
    const path = relative(base, target);
    return path && !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep) ? target : null;
  } catch {
    return null;
  }
}
