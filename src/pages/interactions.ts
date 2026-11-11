import type { APIRoute } from 'astro';
import { allowAttempt, isOwner, preventCaching, returnPath } from '../lib/auth';
import { allowsComments, publicComments, textToComment, updateInteractions } from '../lib/interactions';
import { comments, getEntries } from '../lib/site';

export const POST: APIRoute = async ({ request, url, cookies, clientAddress }) => {
  const headers = new Headers();
  preventCaching(headers);
  const fail = (status: number, message: string) => new Response(message, { status, headers });
  const go = (path: string) => {
    headers.set('Location', path);
    return new Response(null, { status: 303, headers });
  };
  if (request.headers.get('Origin') !== url.origin) return fail(403, '此表单只接受同站请求。');
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') ||
      Number(request.headers.get('Content-Length') ?? 0) > 50_000) return fail(400, '表单格式无效。');
  const text = await request.text();
  if (text.length > 50_000) return fail(400, '表单内容过长。');
  const fields = new URLSearchParams(text);
  const action = fields.get('action');
  if (action === 'approve' || action === 'reject') {
    if (!isOwner(cookies)) return fail(403, '请先登录站主管理。');
    const id = Number(fields.get('comment_id'));
    const found = await updateInteractions((state) => {
      const index = state.comments.findIndex((comment) => comment.id === id && comment.status === 'pending');
      if (index < 0) return false;
      if (action === 'approve') state.comments[index].status = 'approved';
      else state.comments.splice(index, 1);
      return true;
    });
    return found ? go('/auth/comments/') : fail(404, '这条待审核留言已处理。');
  }

  const entry = (await getEntries()).find((item) => String(item.id) === fields.get('entry'));
  if (!entry || entry.visibility) return fail(404, '内容不存在。');
  if (action === 'like') {
    if (entry.type !== 'shuoshuo') return fail(404, '内容不存在。');
    const liked = (cookies.get('argon_talk_likes')?.value ?? '').split(',').filter((id) => /^[\w-]{1,80}$/.test(id));
    const id = String(entry.id);
    const target = returnPath(fields.get('return'), entry.path);
    if (liked.includes(id)) return go(target);
    if (!allowAttempt(clientAddress, 'likes')) return fail(429, '操作太快，请稍后再试。');
    await updateInteractions((state) => { state.likes[id] = (state.likes[id] ?? 0) + 1; });
    cookies.set('argon_talk_likes', [...liked.slice(-79), id].join(','), {
      httpOnly: true, sameSite: 'lax', secure: !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
      path: '/', maxAge: 365 * 86400,
    });
    return go(target);
  }

  if (action !== 'comment' || !allowsComments(entry)) return fail(403, '此处未开放留言。');
  const back = (status: string) => go(entry.path + '?comment=' + status + '#post_comment');
  const body = fields.get('comment')?.trim() ?? '';
  const author = fields.get('author')?.trim() || '匿名';
  const website = fields.get('website')?.trim() ?? '';
  const parent = Number(fields.get('parent') || 0);
  if (!body || body.length > 4000 || author.length > 60 || website.length > 500 ||
      (website && !/^https?:\/\/[^\s]+$/i.test(website)) || !Number.isSafeInteger(parent) || parent < 0) return back('invalid');
  if (!allowAttempt(clientAddress, 'comments')) return back('rate');
  const accepted = await updateInteractions((state) => {
    const publicItems = [...comments, ...publicComments(state)];
    if (parent && !publicItems.some((item) => item.id === parent && item.post_id === entry.id)) return false;
    const html = textToComment(body);
    const duplicate = state.comments.some((item) => item.status === 'pending' && item.post_id === entry.id &&
      item.author === author && item.parent === parent && item.html === html && Date.now() - Date.parse(item.date) < 60_000);
    if (duplicate) return true;
    const max = state.comments.reduce((largest, item) => Math.max(largest, item.id), 100_000_000);
    state.comments.push({
      id: max + 1, post_id: entry.id, parent, author, author_url: website,
      date: new Date().toISOString(), html, status: 'pending',
    });
    return true;
  });
  return back(accepted ? 'pending' : 'invalid');
};
