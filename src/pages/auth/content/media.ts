import type { APIRoute } from 'astro';
import { isOwner, preventCaching } from '../../../lib/auth';
import { ownerEntries } from '../../../lib/editor';
import { listEditorMedia, mediaLimit, saveEditorMedia } from '../../../lib/editor-media';

export const GET: APIRoute = async ({ cookies }) => {
  const headers = new Headers();
  preventCaching(headers);
  if (!isOwner(cookies)) return new Response(null, { status: 403, headers });
  const uploaded = await listEditorMedia();
  const media = new Map(uploaded.map((item) => [item.url, item]));
  for (const { entry } of (await ownerEntries()).values()) {
    const images = [...entry.html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1].replaceAll('&amp;', '&'));
    for (const url of [entry.featuredImage, ...images]) {
      if (!url || media.has(url) || !/^(?:\/(?!\/)|https?:\/\/)/i.test(url)) continue;
      let name = url.split('/').at(-1)?.split('?')[0] || '图片';
      try { name = decodeURIComponent(name); } catch { /* Preserve filenames with literal percent signs. */ }
      media.set(url, { url, name, mime: 'image/*', size: 0, created: entry.published });
    }
  }
  return Response.json([...media.values()].sort((a,b) => b.created.localeCompare(a.created)), { headers });
};

export const POST: APIRoute = async ({ cookies, request, url }) => {
  const headers = new Headers();
  preventCaching(headers);
  if (!isOwner(cookies) || request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403, headers });
  if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data') || Number(request.headers.get('Content-Length') ?? 0) > mediaLimit + 65536) return Response.json({ error: '文件太大或上传格式无效。' }, { status: 413, headers });
  try {
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) return Response.json({ error: '请选择文件。' }, { status: 400, headers });
    return Response.json(await saveEditorMedia(file), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error && !('code' in error) ? error.message : '上传失败，请重试。' }, { status: 400, headers });
  }
};
