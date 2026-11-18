import type { APIRoute } from 'astro';
import { isOwner, preventCaching } from '../../lib/auth';
import { renderEditorSource } from '../../lib/editor';

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const headers = new Headers();
  preventCaching(headers);
  if (!isOwner(cookies) || request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403, headers });
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') || Number(request.headers.get('Content-Length') ?? 0) > 1500000) return new Response(null, { status: 400, headers });
  const body = await request.text();
  if (body.length > 1500000) return new Response(null, { status: 413, headers });
  const source = new URLSearchParams(body).get('body') ?? '';
  if (source.length > 150000) return new Response(null, { status: 413, headers });
  return Response.json({ html: renderEditorSource(source, 'markdown') }, { headers });
};
