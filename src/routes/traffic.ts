import type { APIRoute } from 'astro';
import { isOwner, preventCaching } from '../lib/auth';
import { counterEnabled, recordView } from '../lib/counter';
import { editorialChanges } from '../lib/editor-store';
import { restrictedData, findRestricted } from '../lib/private-store';
import { canonicalPath, getEntries, terms } from '../lib/site';

const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const headers = new Headers();
  preventCaching(headers);
  const status = (value: number) => new Response(null, { status: value, headers });
  if (!counterEnabled()) return status(404);
  if (request.headers.get('Origin') !== url.origin || isOwner(cookies)) return status(403);
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') ||
      Number(request.headers.get('Content-Length') ?? 0) > 1800) return status(400);
  const body = await request.text();
  if (body.length > 1800) return status(413);
  const fields = new URLSearchParams(body);
  const event = fields.get('event') ?? '';
  const visitor = fields.get('visitor') ?? '';
  const path = fields.get('path') ?? '';
  if (!uuid.test(event) || (visitor && !uuid.test(visitor)) || path.length > 1400 || !/^\/(?!\/)[^?#\\\x00-\x1f]*$/.test(path)) return status(400);
  const route = canonicalPath(path);
  const edits = editorialChanges();
  if (findRestricted(await restrictedData(edits), route, null)) return status(404);
  const entry = (await getEntries(edits)).find((item) => canonicalPath(item.path) === route);
  const base = route.replace(/\/page\/[1-9]\d*\/$/, '/');
  if (!entry && !['/', '/archive/', '/shuoshuo/'].includes(base) && !/^\/\d{4}(?:\/\d{2}(?:\/\d{2})?)?\/$/.test(base) &&
      ![...terms.category, ...terms.post_tag].some((term) => canonicalPath(term.url) === base)) return status(404);
  if (/bot|crawler|spider|slurp/i.test(request.headers.get('User-Agent') ?? '')) return status(204);
  const result = recordView(event, visitor || undefined, entry?.type === 'post' ? entry.id : undefined);
  return Response.json(result, { headers });
};
