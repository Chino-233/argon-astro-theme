import type { APIRoute } from 'astro';
import { isOwner, preventCaching } from '../../../lib/auth';
import { optionGroups } from '../../../lib/argon-options';
import { customCss, siteOptions } from '../../../lib/site';

export const GET: APIRoute = ({ cookies, locals }) => {
  const headers = new Headers();
  preventCaching(headers);
  if (!isOwner(cookies)) return new Response(null, { status: 403, headers });
  const option = siteOptions(locals.argonOverrides);
  const settings = Object.fromEntries(optionGroups.flatMap((group) => group.fields.map((field) => {
    const key = 'argon_' + field.key;
    return [key, locals.argonOverrides[key] ?? (field.key === 'custom_css' ? customCss : option(field.key, field.default))];
  })));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Content-Disposition', 'attachment; filename="argon-settings.json"');
  return new Response(JSON.stringify(settings, null, 2) + '\n', { headers });
};
