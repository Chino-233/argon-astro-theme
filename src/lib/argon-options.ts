import sanitizeHtml from 'sanitize-html';

type Choice = readonly [value: string, label: string];
type Field = {
  key: string;
  label: string;
  type: 'text' | 'url' | 'number' | 'color' | 'select' | 'metadata' | 'html' | 'css';
  default: string;
  choices?: readonly Choice[];
  min?: number;
  max?: number;
  step?: number;
};

const enabled = (key: string, label: string, on = false): Field => ({
  key, label, type: 'select', default: String(on), choices: [['false', '关闭'], ['true', '开启']],
});
const select = (key: string, label: string, value: string, choices: readonly Choice[]): Field => (
  { key, label, type: 'select', default: value, choices }
);
const field = (key: string, label: string, type: Field['type'] = 'text', value = ''): Field => (
  { key, label, type, default: value }
);
const number = (key: string, label: string, value: string, min: number, max: number, step: number): Field => (
  { key, label, type: 'number', default: value, min, max, step }
);

export const metadataChoices: readonly Choice[] = [
  ['time', '发布时间'], ['views', '浏览量'], ['comments', '评论数'],
  ['categories', '分类'], ['edittime', '编辑时间'], ['author', '作者'],
];

export const optionGroups: Array<{ title: string; fields: Field[] }> = [
  {
    title: '布局与配色',
    fields: [
      field('theme_color', '主题色', 'color', '#5e72e4'),
      select('page_layout', '页面布局', 'double', [['double', '双栏'], ['double-reverse', '双栏（侧栏在右）'], ['single', '单栏']]),
      number('card_radius', '卡片圆角（px）', '4', 0, 30, .5),
      select('font', '默认字体', 'sans-serif', [['sans-serif', '无衬线'], ['serif', '衬线']]),
      select('card_shadow', '卡片阴影', 'default', [['default', '默认'], ['small', '浅阴影'], ['big', '深阴影']]),
      select('darkmode_autoswitch', '夜间模式', 'false', [['false', '默认日间'], ['alwayson', '默认夜间'], ['system', '跟随系统'], ['time', '根据时段']]),
      enabled('enable_amoled_dark', '允许纯黑模式'),
      enabled('toolbar_blur', '顶栏模糊效果'),
    ],
  },
  {
    title: 'Banner 与背景',
    fields: [
      field('banner_title', 'Banner 标题'),
      field('banner_subtitle', 'Banner 副标题'),
      select('banner_size', 'Banner 高度', 'default', [['default', '普通'], ['fullscreen', '全屏']]),
      field('banner_background_url', 'Banner 图片地址', 'url'),
      select('banner_background_color_type', 'Banner 配色', 'shape-primary', [['shape-primary', '主题色'], ['shape-default', '默认'], ['shape-dark', '深色'], ['bg-gradient-success', '绿色'], ['bg-gradient-info', '蓝色'], ['bg-gradient-warning', '暖橙色']]),
      enabled('banner_background_hide_shapes', '隐藏 Banner 装饰圆形'),
      enabled('enable_banner_title_typing_effect', 'Banner 打字动画'),
      number('banner_typing_effect_interval', '打字间隔（毫秒）', '100', 20, 500, 1),
      field('page_background_url', '日间页面背景', 'url'),
      field('page_background_dark_url', '夜间页面背景', 'url'),
      number('page_background_opacity', '背景不透明度', '1', 0, 1, .05),
      select('page_background_banner_style', 'Banner 与页面背景', 'default', [['default', '独立显示'], ['transparent', 'Banner 透明']]),
    ],
  },
  {
    title: '侧栏',
    fields: [
      field('sidebar_announcement', '公告'),
      field('sidebar_banner_title', '侧栏标题'),
      field('sidebar_banner_subtitle', '侧栏副标题'),
      field('sidebar_auther_image', '头像地址', 'url'),
      field('sidebar_auther_name', '作者名称'),
      field('sidebar_author_description', '作者简介'),
      enabled('show_headindex_number', '目录显示编号'),
    ],
  },
  {
    title: '文章与浏览信息',
    fields: [
      select('article_list_layout', '文章卡片布局', '2', [['1', '样式 1'], ['2', '样式 2'], ['3', '样式 3']]),
      select('article_header_style', '正文小标题样式', 'article-header-style-2', [['default', '默认'], ['article-header-style-1', '下划线'], ['article-header-style-2', '左侧标记']]),
      field('article_meta', '浏览信息顺序', 'metadata', 'time|views|categories|edittime'),
      select('dateformat', '日期格式', 'YMD', [['YMD', '年-月-日'], ['MDY', '月-日-年'], ['DMY', '日-月-年']]),
      enabled('show_readingtime', '显示字数和阅读时间', true),
      enabled('show_thumbnail_in_banner_in_content_page', '用文章封面替换 Banner 背景'),
      enabled('enable_code_highlight', '代码高亮'),
      select('math_render', '公式渲染', 'false', [['false', '关闭'], ['katex', 'KaTeX']]),
      enabled('enable_zoomify', '点击图片放大'),
    ],
  },
  {
    title: '导航与浮动按钮',
    fields: [
      enabled('pjax_disabled', '关闭无刷新导航'),
      enabled('fab_show_darkmode_button', '显示夜间模式按钮'),
      enabled('fab_show_gotocomment_button', '显示跳转评论按钮'),
      enabled('fab_show_settings_button', '显示访客主题设置按钮', true),
      enabled('show_customize_theme_color_picker', '允许访客选择主题色'),
    ],
  },
  {
    title: '页脚与自定义样式',
    fields: [field('footer_html', '页脚 HTML', 'html'), field('custom_css', '自定义 CSS', 'css')],
  },
];

export type ArgonOptions = Record<string, string | boolean | number>;

export function option(overrides: Record<string, string>, base: ArgonOptions, name: string, fallback = '') {
  const key = 'argon_' + name;
  const value = overrides[key] ?? base[key];
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function validUrl(value: string) {
  if (!value) return true;
  if (/[\\\u0000-\u0020"'<>]/u.test(value)) return false;
  if (/^\/(?!\/)/.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function footerHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'style'],
    allowedAttributes: { '*': ['class', 'id', 'style', 'title', 'aria-*'], a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    // The owner can configure style rules. Executable HTML and event handlers are filtered.
    allowVulnerableTags: true,
    transformTags: {
      a: (tagName, attrs) => ({ tagName, attribs: attrs.target === '_blank' ? { ...attrs, rel: 'noopener noreferrer' } : attrs }),
    },
  });
}

export function validateOptions(raw: Record<string, unknown>) {
  const settings: Record<string, string> = {};
  for (const group of optionGroups) {
    for (const item of group.fields) {
      const key = 'argon_' + item.key;
      if (!Object.hasOwn(raw, key)) continue;
      const input = raw[key];
      if (!['string', 'boolean', 'number'].includes(typeof input)) throw new Error(item.label + '的格式不正确。');
      const value = String(input).trim();
      const numberValue = Number(value);
      const metadata = value.split('|').filter(Boolean);
      const valid = value.length <= (item.type === 'html' || item.type === 'css' ? 16384 : 2048) && (
        item.type === 'select' ? item.choices?.some(([choice]) => choice === value) :
        item.type === 'color' ? /^#[\da-f]{6}$/i.test(value) :
        item.type === 'url' ? validUrl(value) :
        item.type === 'number' ? value !== '' && Number.isFinite(numberValue) && numberValue >= item.min! && numberValue <= item.max! :
        item.type === 'metadata' ? metadata.every((entry) => metadataChoices.some(([choice]) => choice === entry)) :
        item.type === 'css' ? !/<\/style/i.test(value) :
        true
      );
      if (!valid) throw new Error(item.label + '的值不在允许范围内。');
      settings[key] = item.type === 'metadata' ? [...new Set(metadata)].join('|') : item.type === 'html' ? footerHtml(value) : value;
    }
  }
  return settings;
}
