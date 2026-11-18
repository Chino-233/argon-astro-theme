import type { APIRoute } from 'astro';
import { isOwner, preventCaching } from '../../lib/auth';
import { optionGroups, validateOptions } from '../../lib/argon-options';
import { saveOverrides } from '../../lib/argon-state';
import { customCss, site, siteOptions } from '../../lib/site';

export const POST: APIRoute = async ({ cookies, locals, request, url }) => {
  const headers = new Headers();
  preventCaching(headers);
  if (!isOwner(cookies) || request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403, headers });
  const redirect = (query: string) => {
    headers.set('Location', '/auth/argon/?' + query);
    return new Response(null, { status: 303, headers });
  };
  const fail = (message: string) => redirect('error=' + encodeURIComponent(message));
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') ||
      Number(request.headers.get('Content-Length') ?? 0) > 230_000) return fail('表单格式无效或内容太长。');

  const body = await request.text();
  if (body.length > 230_000) return fail('表单内容太长。');
  const form = new URLSearchParams(body);
  const importing = form.get('action') === 'import';
  if (!importing && form.get('action') !== 'save') return fail('表单操作无效。');

  let settings: Record<string, string>;
  try {
    const raw = importing ? JSON.parse(form.get('settings') ?? '') : Object.fromEntries(form);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('请提供 Argon 设置 JSON 对象。');
    if (importing) {
      for (const key of Object.keys(raw)) {
        if (!key.endsWith('_url') && key !== 'argon_sidebar_auther_image') continue;
        if (typeof raw[key] !== 'string') continue;
        try {
          const candidate = new URL(raw[key]);
          if (candidate.hostname === new URL(site.url).hostname && candidate.pathname.startsWith('/wp-content/uploads/')) {
            raw[key] = candidate.pathname + candidate.search;
          }
        } catch { /* Local URLs are already in the appropriate format. */ }
      }
    }
    if (!importing) {
      const option = siteOptions(locals.argonOverrides);
      for (const group of optionGroups) for (const field of group.fields) {
        const key = 'argon_' + field.key;
        const current = locals.argonOverrides[key] ?? (field.key === 'custom_css' ? customCss : option(field.key, field.default));
        if (typeof raw[key] === 'string' && raw[key].replaceAll('\r\n', '\n') === current.replaceAll('\r\n', '\n')) delete raw[key];
      }
    }
    settings = validateOptions(raw);
  } catch (error) {
    return fail(error instanceof SyntaxError ? 'JSON 无法解析。' : error instanceof Error ? error.message : '设置格式无效。');
  }
  if (!Object.keys(settings).length) return importing ? fail('没有找到可导入的设置。') : redirect('saved=1');
  try { await saveOverrides(settings); }
  catch (error) {
    console.error('Argon settings could not be saved', error);
    return fail('无法保存到服务器。请检查设置目录的写权限。');
  }
  return redirect(importing ? 'saved=import' : 'saved=1');
};
