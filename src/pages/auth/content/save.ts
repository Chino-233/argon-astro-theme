import type { APIRoute } from 'astro';
import { isOwner, preventCaching } from '../../../lib/auth';
import { EditorInputError, editEntry, ownerEntries } from '../../../lib/editor';
import { saveEditorialChange } from '../../../lib/editor-store';

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const headers = new Headers();
  preventCaching(headers);
  if (!isOwner(cookies) || request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403, headers });
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') ||
      Number(request.headers.get('Content-Length') ?? 0) > 1_500_000) return new Response('表单格式或大小无效。', { status: 400, headers });
  const body = await request.text();
  if (body.length > 1_500_000) return new Response('表单太大。', { status: 413, headers });
  const form = new URLSearchParams(body);
  const records = await ownerEntries();
  const json = request.headers.get('Accept')?.includes('application/json');
  try {
    const edited = await editEntry(form, records);
    if (!saveEditorialChange(edited, form.get('revision') ?? '')) {
      throw new EditorInputError('内容已在另一个窗口修改。请重新打开编辑页面后再保存。');
    }
    const location = '/auth/content/?' + new URLSearchParams({ type: edited.entry.type, id: String(edited.entry.id), saved: edited.draft ? 'draft' : 'publish' });
    if (json) return Response.json({ id: edited.entry.id, revision: edited.revision, location, path: edited.entry.path, draft: edited.draft, live: !!edited.live }, { headers });
    headers.set('Location', location);
    return new Response(null, { status: 303, headers });
  } catch (error) {
    if (error instanceof EditorInputError) {
      if (json) return Response.json({ error: error.message }, { status: 400, headers });
      headers.set('Content-Type', 'text/plain; charset=utf-8');
      return new Response(error.message + ' 请返回原页面修改。', { status: 400, headers });
    }
    throw error;
  }
};
