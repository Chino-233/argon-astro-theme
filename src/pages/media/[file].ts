import type { APIRoute } from 'astro';
import { canRead, isOwner, preventCaching } from '../../lib/auth';
import { editorialChanges } from '../../lib/editor-store';
import { readEditorMedia, validMediaFile } from '../../lib/editor-media';
import { restrictedData } from '../../lib/private-store';
import { getEntries } from '../../lib/site';

export const GET: APIRoute = async ({ params, cookies, request }) => {
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff' });
  const file = params.file ?? '';
  if (!validMediaFile(file)) return new Response(null, { status: 404 });
  const path = '/media/' + file;
  const referenced = (entry: { html: string; featuredImage?: string }) => entry.html.includes(path) || entry.featuredImage === path;
  const edits = editorialChanges();
  const published = (await getEntries(edits)).some(referenced);
  if (!published) {
    preventCaching(headers);
    const allowed = isOwner(cookies) || (await restrictedData(edits)).posts.some((entry) => referenced(entry) && canRead(entry, cookies));
    if (!allowed) return new Response(null, { status: 404, headers });
  } else headers.set('Cache-Control', 'no-store');
  try {
    const { bytes, info } = await readEditorMedia(file);
    headers.set('Content-Type', info.mime);
    headers.set('Content-Disposition', (info.mime === 'application/pdf' ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(info.name));
    headers.set('Accept-Ranges', 'bytes');
    const range = request.headers.get('Range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match?.[2] || 0));
      const end = match?.[1] && match[2] ? Math.min(bytes.length-1, Number(match[2])) : bytes.length-1;
      if (!match || start > end || start >= bytes.length) { headers.set('Content-Range', 'bytes */' + bytes.length); return new Response(null, { status: 416, headers }); }
      headers.set('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
      headers.set('Content-Length', String(end-start+1));
      return new Response(new Uint8Array(bytes.subarray(start,end+1)), { status: 206, headers });
    }
    headers.set('Content-Length', String(bytes.length));
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return new Response(null, { status: 404, headers });
  }
};
