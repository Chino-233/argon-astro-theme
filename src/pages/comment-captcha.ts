import type { APIRoute } from 'astro';
import { issueCaptcha } from '../lib/comment-captcha';
import { allowsComments } from '../lib/interactions';
import { getEntries, siteOptions } from '../lib/site';

export const GET: APIRoute = async ({ locals, url }) => {
  const option = siteOptions(locals.argonOverrides);
  if (option('comment_need_captcha') !== 'true' || option('get_captcha_by_ajax') !== 'true') return new Response(null, { status: 404 });
  const id = url.searchParams.get('entry');
  const entry = (await getEntries()).find((item) => String(item.id) === id);
  if (!entry || !allowsComments(entry)) return new Response(null, { status: 404 });
  return Response.json(issueCaptcha(String(entry.id)), { headers: { 'Cache-Control': 'no-store' } });
};
