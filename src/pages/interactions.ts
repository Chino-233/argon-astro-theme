import { createHash, randomBytes } from 'node:crypto';
import type { APIRoute } from 'astro';
import { allowAttempt, isOwner, preventCaching, returnPath } from '../lib/auth';
import { allowsComments, commentDevice, commentPins, commentVisitor, ownsComment, publicComments, renderComment, updateInteractions } from '../lib/interactions';
import { verifyCaptcha } from '../lib/comment-captcha';
import { commentMailConfigured, sendCommentMail } from '../lib/comment-mail';
import { comments, getEntries, site, siteOptions } from '../lib/site';

export const POST: APIRoute = async ({ request, url, cookies, clientAddress, locals }) => {
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
  const owner = isOwner(cookies);
  const option = siteOptions(locals.argonOverrides);
  const enabled = (name: string) => option(name) === 'true';
  if (action === 'approve' || action === 'reject') {
    if (!owner) return fail(403, '请先登录站主管理。');
    const id = Number(fields.get('comment_id'));
    const result = await updateInteractions((state) => {
      const index = state.comments.findIndex((item) => item.id === id && (item.status === 'pending' || item.revision));
      const item = state.comments[index];
      if (!item) return null;
      if (item.revision) {
        if (action === 'approve') {
          (item.history ??= []).push({ html: item.html, source: item.source ?? '', date: item.editedAt ?? item.date });
          item.html = item.revision.html;
          item.source = item.revision.source;
          item.editedAt = item.revision.date;
        }
        delete item.revision;
        return {};
      }
      if (action === 'reject') {
        state.comments.splice(index, 1);
        return {};
      }
      item.status = 'approved';
      const parent = state.comments.find((candidate) => candidate.id === item.parent && candidate.mailVerified && !candidate.ownerOnly);
      return item.ownerOnly ? {} : { item, parent };
    });
    if (!result) return fail(404, '这条待审核留言已处理。');
    if (result.item && enabled('comment_allow_mailnotice') && commentMailConfigured()) {
      const item = result.item;
      const entry = (await getEntries()).find((entry) => entry.id === item.post_id && !entry.visibility);
      if (entry) {
        await sendCommentMail(item, site.url);
        if (result.parent) await sendCommentMail(result.parent, site.url, entry.path + '#comment-' + item.id);
      }
    }
    return go('/auth/comments/');
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

  if (!allowsComments(entry)) return fail(403, '此处未开放留言。');
  const commentId = Number(fields.get('comment_id'));
  if (action === 'pin' || action === 'comment-like') {
    if (action === 'pin' && (!owner || !enabled('enable_comment_pinning'))) return fail(403, '此处未开放置顶。');
    if (action === 'comment-like' && !enabled('enable_comment_upvote')) return fail(403, '此处未开放点赞。');
    const visitor = action === 'comment-like' ? commentVisitor(cookies, url) : undefined;
    if (visitor && !allowAttempt(clientAddress, 'comment-likes')) return fail(429, '操作太快，请稍后再试。');
    const updated = await updateInteractions((state) => {
      const item = [...comments, ...publicComments(state)].find((candidate) => candidate.id === commentId && candidate.post_id === entry.id);
      if (!item) return false;
      if (action === 'pin') {
        const key = String(entry.id);
        const pins = commentPins(state, entry.id, comments);
        (state.pinnedComments ??= {})[key] = pins.includes(item.id)
          ? pins.filter((id) => id !== item.id) : [item.id, ...pins];
      } else if (visitor) {
        const votes = (state.commentVotes ??= {})[item.id] ??= [];
        if (!votes.includes(visitor)) votes.push(visitor);
      }
      return true;
    });
    return updated ? go(entry.path + '#comment-' + commentId) : fail(404, '找不到这条留言。');
  }

  if (action !== 'comment' && action !== 'comment-edit') return fail(400, '表单操作无效。');
  const back = (status: string) => go(entry.path + '?comment=' + status + '#post_comment');
  const edit = action === 'comment-edit';
  if (edit && !enabled('comment_allow_editing')) return fail(403, '留言编辑已关闭。');
  if (!allowAttempt(clientAddress, 'comments')) return back('rate');
  if (enabled('comment_need_captcha') && !edit &&
      !verifyCaptcha(String(entry.id), fields.get('captcha_token') ?? '', fields.get('captcha')?.trim() ?? '')) return back('captcha');
  const body = fields.get('comment')?.trim() ?? '';
  const showIdentity = !enabled('hide_name_email_site_input');
  const author = (showIdentity ? fields.get('author')?.trim() : '') || '匿名';
  const website = (showIdentity ? fields.get('website')?.trim() : '') ?? '';
  const contact = (showIdentity ? fields.get('email')?.trim() : '') ?? '';
  const qq = enabled('comment_enable_qq_avatar') && /^\d{5,12}$/.test(contact) ? contact : '';
  const email = qq ? '' : contact;
  const parent = Number(fields.get('parent') || 0);
  if (!body || body.length > 4000 || author.length > 60 || website.length > 500 ||
      (website && !/^https?:\/\/[^\s]+$/i.test(website)) || !Number.isSafeInteger(parent) || parent < 0 ||
      (email && (email.length > 254 || !/^[^\s<>,@]+@[^\s<>,@]+\.[^\s<>,@]+$/.test(email)))) return back('invalid');
  const visitor = commentVisitor(cookies, edit ? undefined : url);
  const html = renderComment(body, enabled('comment_allow_markdown'), enabled('comment_emotion_keyboard'));
  const date = new Date().toISOString();
  if (edit) {
    const edited = await updateInteractions((state) => {
      const item = state.comments.find((item) => item.id === commentId && item.post_id === entry.id);
      if (!item || !ownsComment(item, visitor)) return false;
      if (item.status === 'pending') Object.assign(item, { html, source: body });
      else item.revision = { html, source: body, date };
      return true;
    });
    return edited ? back('pending') : fail(403, '只能编辑自己发送的留言。');
  }

  const ownerOnly = enabled('comment_allow_privatemode') && fields.get('private') === 'on';
  const avatar = !ownerOnly && fields.get('avatar') === 'on'
    ? qq ? 'qq:' + qq : email ? createHash('md5').update(email.toLowerCase()).digest('hex') : undefined
    : undefined;
  const subscribed = !ownerOnly && email && fields.get('notify') === 'on' &&
    enabled('comment_allow_mailnotice') && commentMailConfigured();
  const accepted = await updateInteractions((state) => {
    const publicItems = [...comments, ...publicComments(state)];
    if (parent && !publicItems.some((item) => item.id === parent && item.post_id === entry.id)) return false;
    const duplicate = state.comments.some((item) => item.status === 'pending' && item.post_id === entry.id &&
      item.visitor === visitor && item.parent === parent && item.html === html && Date.now() - Date.parse(item.date) < 60_000);
    if (duplicate) return true;
    const id = (state.lastCommentId ?? state.comments.reduce((largest, item) => Math.max(largest, item.id), 100_000_000)) + 1;
    state.lastCommentId = id;
    state.comments.push({
      id, post_id: entry.id, parent, author, author_url: website,
      date, html, source: body, visitor, status: 'pending', ownerOnly,
      ...(avatar ? { avatar } : {}),
      ...(subscribed ? { email, mailToken: randomBytes(32).toString('hex') } : {}),
      ...(option('comment_ua', 'hidden') !== 'hidden' ? { device: commentDevice(request.headers.get('User-Agent') ?? '') } : {}),
    });
    return true;
  });
  return back(accepted ? 'pending' : 'invalid');
};
