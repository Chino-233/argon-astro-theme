import nodemailer from 'nodemailer';
import type { StoredComment } from './interactions';

export function commentMailConfigured() {
  return Boolean(process.env.ARGON_SMTP_URL && process.env.ARGON_MAIL_FROM);
}

export async function sendCommentMail(comment: StoredComment, origin: string, path?: string) {
  const smtp = process.env.ARGON_SMTP_URL;
  const from = process.env.ARGON_MAIL_FROM;
  if (!smtp || !from || !comment.mailToken || !comment.email) return;
  const action = new URL('/comment-subscription/', origin);
  action.searchParams.set('id', String(comment.id));
  action.searchParams.set('token', comment.mailToken);
  action.searchParams.set('action', path ? 'unsubscribe' : 'confirm');
  try {
    const transport = nodemailer.createTransport(smtp, { connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 10_000 });
    await transport.sendMail({
      from, to: comment.email,
      subject: path ? '你的留言有了新回复' : '确认订阅留言回复',
      text: path
        ? '查看回复：' + new URL(path, origin).href + '\n\n取消订阅：' + action.href
        : '请打开链接并确认订阅。\n\n' + action.href,
    });
  } catch {
    console.error('Argon comment notification could not be delivered.');
  }
}
