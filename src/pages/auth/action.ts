import type { APIRoute } from 'astro';
import { allowAttempt, authConfigured, logout, ownerLogin, preventCaching, returnPath, unlockEntry, verifyPassword } from '../../lib/auth';
import { restrictedData } from '../../lib/private-store';

export const POST: APIRoute = async ({ request, url, cookies, clientAddress }) => {
  const headers = new Headers();
  preventCaching(headers);
  const fail = (status: number, text: string) => new Response(text, { status, headers });
  const redirect = (path: string) => {
    headers.set('Location', path);
    return new Response(null, { status: 303, headers });
  };
  const origin = request.headers.get('Origin');
  if (origin !== url.origin) return fail(403, '此表单只接受同站请求。');
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > 4096 || !request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')) {
    return fail(400, '无效的表单请求。');
  }
  const body = await request.text();
  if (body.length > 4096) return fail(400, '无效的表单请求。');
  const fields = new URLSearchParams(body);
  const intent = fields.get('intent');
  if (intent === 'logout') {
    logout(cookies, request.headers.get('Cookie') ?? '');
    return redirect('/');
  }
  if (!allowAttempt(clientAddress)) return fail(429, '尝试次数过多，请稍后重试。');
  const password = fields.get('password') ?? '';
  if (intent === 'login') {
    const next = returnPath(fields.get('return'), '/auth/');
    if (!authConfigured()) return fail(503, '站主登录尚未配置。');
    if (await verifyPassword(password, process.env.ARGON_ADMIN_PASSWORD_HASH) && ownerLogin(cookies, url)) {
      return redirect(next);
    }
    return redirect('/auth/?error=1&return=' + encodeURIComponent(next));
  }
  if (intent === 'unlock') {
    const data = await restrictedData();
    const entry = data.posts.find((post) => String(post.id) === fields.get('id') && post.visibility === 'password');
    if (!entry) return fail(404, '页面不存在。');
    if (await verifyPassword(password, entry.passwordHash) && unlockEntry(cookies, entry, url)) {
      return redirect(entry.path);
    }
    return redirect(entry.path + '?error=1');
  }
  return fail(400, '无效的表单请求。');
};
