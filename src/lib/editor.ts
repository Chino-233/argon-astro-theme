import { randomUUID } from 'node:crypto';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { hashPassword } from './auth';
import { editorialChanges, publishedEditorialEntry, type EditableEntry } from './editor-store';
import { originalRestrictedData } from './private-store';
import { canonicalPath, originalEntries, stamp, terms } from './site';
import type { Entry } from './types';

export async function ownerEntries() {
  const [published, restricted] = await Promise.all([originalEntries(), originalRestrictedData()]);
  const records = new Map<string, EditableEntry>([...published, ...restricted.posts].map((entry) => [String(entry.id), {
    entry, source: entry.html, format: entry.sourceFormat ?? 'html', draft: false, revision: '',
  } satisfies EditableEntry]));
  for (const [id, record] of editorialChanges()) records.set(id, record);
  return records;
}

export class EditorInputError extends Error {}

const mathTags = ['math', 'mrow', 'mi', 'mn', 'mo', 'mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup', 'mtable', 'mtr', 'mtd', 'munder', 'mover', 'munderover', 'mtext', 'mspace', 'menclose', 'mstyle', 'mpadded', 'mphantom', 'mfenced', 'semantics', 'annotation'];

export function renderEditorSource(source: string, format: EditableEntry['format']) {
  const html = format === 'markdown' ? marked.parse(source, { async: false, breaks: true }) : source;
  return sanitizeHtml(html, {
    allowedTags: [...new Set([...sanitizeHtml.defaults.allowedTags, ...mathTags, 'img', 'figure', 'figcaption', 'details', 'summary', 'del', 'sup', 'sub', 'audio', 'video', 'source', 'iframe'])],
    allowedAttributes: {
      '*': ['class', 'id', 'title', 'style', 'data-latex'], a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes'],
      audio: ['src', 'controls', 'preload'], video: ['src', 'controls', 'preload', 'poster'], source: ['src', 'type'],
      td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'], ol: ['start', 'reversed'],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'loading', 'title'],
      ...Object.fromEntries(mathTags.map((tag) => [tag, ['display', 'xmlns', 'mathvariant', 'mathsize', 'mathcolor', 'encoding', 'stretchy', 'accent', 'linethickness', 'scriptlevel', 'displaystyle', 'columnalign', 'rowalign', 'columnspacing', 'rowspacing', 'width', 'height', 'depth', 'voffset']])),
    },
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.bilibili.com', 'open.spotify.com', 'music.163.com'],
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        color: [/^(#[a-f\d]{3,8}|rgba?\([\d.\s,%]+\)|[a-z]+|var\(--wp--preset--color--[a-z-]+\))$/i],
        'background-color': [/^(#[a-f\d]{3,8}|rgba?\([\d.\s,%]+\)|[a-z]+|var\(--wp--preset--color--[a-z-]+\))$/i],
        'font-size': [/^(\d+(?:\.\d+)?(?:px|em|rem|pt|%)|var\(--wp--preset--font-size--[a-z-]+\))$/],
        'line-height': [/^\d+(?:\.\d+)?(?:px|em|rem|%)?$/],
        'padding-left': [/^\d+(?:px|em|rem)$/],
        'text-decoration': [/^(underline|line-through)$/],
        width: [/^\d+(?:px|%)$/], height: [/^\d+(?:px|%)$/],
        'max-width': [/^\d+(?:px|%)$/], 'min-height': [/^\d+(?:px|em|rem|vh)$/],
        'flex-basis': [/^\d+(?:\.\d+)?(?:px|%)$/],
        gap: [/^\d+(?:\.\d+)?(?:px|em|rem)$/],
        'border-radius': [/^\d+(?:px|%)$/],
        'aspect-ratio': [/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/],
        'object-fit': [/^(cover|contain|fill|none|scale-down)$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'], allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) },
  });
}

export async function editEntry(form: URLSearchParams, records: Map<string, EditableEntry>) {
  const id = form.get('id') || '';
  const old = id ? records.get(id) : undefined;
  const type = old?.entry.type ?? form.get('type');
  const enteredTitle = (form.get('title') ?? '').trim();
  const title = enteredTitle || (type === 'shuoshuo' ? '说说' : '（无标题）');
  const source = form.get('body') ?? '';
  const excerpt = (form.get('excerpt') ?? '').trim();
  const format = form.get('format');
  const visibility = form.get('visibility');
  const intent = form.get('intent');
  const draft = intent === 'draft';
  const password = form.get('password') ?? '';
  if ((id && !old) || (type !== 'post' && type !== 'shuoshuo') || (format !== 'markdown' && format !== 'html') ||
      (visibility !== 'public' && visibility !== 'private' && visibility !== 'password') || (intent !== 'draft' && intent !== 'publish')) {
    throw new EditorInputError('编辑请求无效。');
  }
  if (title.length > 200 || source.length > 150_000 || excerpt.length > 2_000 || (!draft && !source.trim())) {
    throw new EditorInputError('请检查标题、正文或摘要的长度。');
  }
  if (Buffer.byteLength(password) > 512) throw new EditorInputError('文章密码太长。');
  const isRestricted = visibility !== 'public';
  if (!isRestricted && /\/auth\/media\//i.test(source)) throw new EditorInputError('正文引用了私密附件，请替换附件地址后再公开。');
  const passwordHash = visibility === 'password'
    ? password ? await hashPassword(password) : old?.entry.passwordHash ?? undefined
    : undefined;
  if (visibility === 'password' && !draft && !passwordHash) throw new EditorInputError('发布密码保护内容时需要设置文章密码。');

  const now = new Date().toISOString();
  const randomId = randomUUID();
  const slug = (form.get('slug') || randomId.slice(0, 8)).trim().toLowerCase();
  if (!old && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new EditorInputError('网址尾部只能使用英文字母、数字和短横线。');
  if (!old && slug.length > 100) throw new EditorInputError('网址尾部太长。');
  const publicationInput = form.get('published');
  const published = publicationInput ? new Date(publicationInput) : new Date(old?.entry.published ?? now);
  if (!Number.isFinite(published.valueOf()) || published.valueOf() > Date.now() + 60_000) throw new EditorInputError('请选择当前或过去的发布时间。');
  const date = stamp(published.toISOString());
  const datePath = [date.year, date.month.padStart(2, '0'), date.day.padStart(2, '0')].join('/');
  const path = old?.entry.path ?? '/' + (type === 'post' ? datePath : 'shuoshuo') + '/' + slug + '/';
  if (!old && [...records.values()].some(({ entry }) => canonicalPath(entry.path) === path)) throw new EditorInputError('这个网址已被使用。');
  const unedited = old && old.source === source && old.format === format;
  const unchangedRenderedHtml = unedited && old.entry.sourceFormat !== 'markdown';
  const categories = form.getAll('category').map(Number).filter((value) => terms.category.some((term) => term.id === value));
  const entry: Entry = {
    ...old?.entry,
    id: old?.entry.id ?? randomId,
    type, title, path, published: published.toISOString(), updated: now, excerpt,
    html: unchangedRenderedHtml ? old.entry.html : renderEditorSource(source, format),
    sourceFormat: 'html',
    categories: type === 'post' ? [...new Set(categories)] : old?.entry.categories,
    tags: form.has('tags_present') ? form.getAll('tag').map(Number).filter((id) => terms.post_tag.some((term) => term.id === id)) : old?.entry.tags,
    featuredImage: form.has('featuredImage') ? validateImage(form.get('featuredImage') ?? '') : old?.entry.featuredImage,
    visibility: visibility === 'public' ? undefined : visibility,
    passwordHash,
    wordCount: unedited ? old.entry.wordCount : undefined,
    readingTime: unedited ? old.entry.readingTime : undefined,
  };
  return { entry, source, format, draft, live: draft ? (old && publishedEditorialEntry(old)) ?? null : entry, revision: randomUUID() } satisfies EditableEntry;
}

function validateImage(value: string) {
  if (!value) return '';
  if (value.length > 2000 || !/^(?:\/(?!\/)|https?:\/\/)/i.test(value) || /[\\\u0000-\u0020]/.test(value)) throw new EditorInputError('特色图片地址无效。');
  return value;
}
