const labels = {
  'zh-hans': { board: '留言板', send: '发送留言' },
  'zh-hant': { board: '留言板', send: '發送留言' },
  en: { board: 'Guestbook', send: 'Leave a message' },
  ru: { board: 'Гостевая книга', send: 'Оставить сообщение' },
};

export function guestbookLabels(locale: string) {
  const language = locale.toLowerCase().replaceAll('_', '-');
  if (/^zh-(hant|tw|hk|mo)(-|$)/.test(language)) return labels['zh-hant'];
  if (language.startsWith('en')) return labels.en;
  if (language.startsWith('ru')) return labels.ru;
  return labels['zh-hans'];
}
