import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import type { APIRoute } from 'astro';
import { preventCaching } from '../../../../lib/auth';
import { locateMedia } from '../../../../lib/private-store';

const mime: Record<string, string> = {
  '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};

const media: APIRoute = async ({ cookies, params, request }) => {
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff' });
  preventCaching(headers);
  const file = await locateMedia(params.scope ?? '', params.file ?? '', cookies);
  if (!file) return new Response(null, { status: 404, headers });
  const info = await stat(file);
  const type = mime[extname(file).toLowerCase()];
  if (!info.isFile() || !type) return new Response(null, { status: 404, headers });
  headers.set('Content-Type', type);
  headers.set('Accept-Ranges', 'bytes');
  const range = request.headers.get('Range');
  let start = 0;
  let end = info.size - 1;
  let status = 200;
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
    }
    if (!match || !(match[1] || match[2]) || start > end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      headers.set('Content-Range', 'bytes */' + info.size);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + info.size);
  }
  headers.set('Content-Length', String(Math.max(0, end - start + 1)));
  const body = request.method === 'HEAD' || !info.size
    ? null
    : Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers });
};

export const GET = media;
export const HEAD = media;
