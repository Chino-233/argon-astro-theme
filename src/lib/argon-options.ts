import sanitizeHtml from 'sanitize-html';
import codeThemes from './code-themes.json';

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
const panguChoices: readonly Choice[] = [
  ['false', '关闭'], ['article', '文章'], ['shuoshuo', '说说'], ['comment', '评论'],
  ['article|comment', '文章和评论'], ['article|shuoshuo', '文章和说说'],
  ['shuoshuo|comment', '说说和评论'], ['article|shuoshuo|comment', '文章、说说和评论'],
];

export const metadataChoices: readonly Choice[] = [
  ['time', '发布时间'], ['views', '浏览量'], ['comments', '评论数'],
  ['categories', '分类'], ['edittime', '编辑时间'], ['author', '作者'],
];

export const optionGroups: Array<{ title: string; fields: Field[] }> = [
  {
    title: '布局与配色',
    fields: [
      field('theme_color', '主题色', 'color', '#5e72e4'),
      select('page_layout', '页面布局', 'double', [['double', '双栏'], ['double-reverse', '双栏（侧栏在右）'], ['single', '单栏'], ['triple', '三栏']]),
      number('card_radius', '卡片圆角（px）', '4', 0, 30, .5),
      select('font', '默认字体', 'sans-serif', [['sans-serif', '无衬线'], ['serif', '衬线']]),
      select('card_shadow', '卡片阴影', 'default', [['default', '默认'], ['small', '浅阴影'], ['big', '深阴影']]),
      select('darkmode_autoswitch', '夜间模式', 'false', [['false', '默认日间'], ['alwayson', '默认夜间'], ['system', '跟随系统'], ['time', '根据时段']]),
      enabled('enable_amoled_dark', '允许纯黑模式'),
      enabled('toolbar_blur', '顶栏模糊效果'),
      enabled('enable_immersion_color', '沉浸式主题色'),
      enabled('disable_googlefont', '禁用 Google Fonts', true),
      enabled('enable_mobile_scale', '允许移动端缩放', true),
    ],
  },
  {
    title: 'Banner 与背景',
    fields: [
      field('banner_title', 'Banner 标题'),
      field('banner_subtitle', 'Banner 副标题'),
      select('banner_size', 'Banner 高度', 'full', [['full', '普通'], ['mini', '紧凑'], ['fullscreen', '全屏'], ['hide', '隐藏']]),
      field('banner_background_url', 'Banner 图片地址', 'url'),
      select('banner_background_color_type', 'Banner 配色', 'shape-primary', [['shape-primary', '主题色'], ['shape-default', '默认'], ['shape-dark', '深色'], ['bg-gradient-success', '绿色'], ['bg-gradient-info', '蓝色'], ['bg-gradient-warning', '暖橙色'], ['bg-gradient-danger', '红色']]),
      enabled('banner_background_hide_shapes', '隐藏 Banner 装饰圆形'),
      enabled('enable_banner_title_typing_effect', 'Banner 打字动画'),
      number('banner_typing_effect_interval', '打字间隔（毫秒）', '100', 20, 500, 1),
      field('page_background_url', '日间页面背景', 'url'),
      field('page_background_dark_url', '夜间页面背景', 'url'),
      number('page_background_opacity', '背景不透明度', '1', 0, 1, .05),
      select('page_background_banner_style', 'Banner 与页面背景', 'false', [['false', '独立显示'], ['transparent', 'Banner 透明']]),
      enabled('show_toolbar_mask', 'Banner 顶部遮罩与标题阴影'),
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
      field('archives_timeline_url', '站点统计的归档链接', 'url'),
    ],
  },
  {
    title: '文章与浏览信息',
    fields: [
      select('article_list_layout', '文章卡片布局', '2', [['1', '样式 1'], ['2', '样式 2'], ['3', '样式 3']]),
      select('article_list_waterflow', '列表列数', '1', [['1', '单列'], ['2', '两列'], ['3', '三列'], ['2and3', '按屏幕宽度自动选择两列或三列']]),
      select('article_header_style', '正文小标题样式', 'article-header-style-2', [['article-header-style-default', '默认'], ['article-header-style-1', '下划线'], ['article-header-style-2', '左侧标记']]),
      field('article_meta', '浏览信息顺序', 'metadata', 'time|views|categories|edittime'),
      select('dateformat', '日期格式', 'YMD', [['YMD', '年-月-日'], ['MDY', '月-日-年'], ['DMY', '日-月-年']]),
      enabled('show_readingtime', '显示字数和阅读时间', true),
      number('reading_speed', '中文阅读速度（字/分钟）', '300', 1, 5000, 1),
      number('reading_speed_en', '英文阅读速度（词/分钟）', '160', 1, 5000, 1),
      number('reading_speed_code', '代码阅读速度（行/分钟）', '20', 1, 5000, 1),
      enabled('show_thumbnail_in_banner_in_content_page', '用文章封面替换 Banner 背景'),
      enabled('enable_code_highlight', '代码高亮'),
      select('code_theme', '代码高亮主题', 'vs2015', codeThemes.map((name) => [name, name] as const)),
      enabled('code_highlight_hide_linenumber', '隐藏代码行号'),
      enabled('code_highlight_break_line', '代码自动折行'),
      enabled('code_highlight_transparent_linenumber', '代码行号背景透明'),
      enabled('disable_codeblock_style', '禁用主题的代码块样式'),
      select('math_render', '公式渲染', 'false', [['false', '关闭'], ['katex', 'KaTeX'], ['mathjax3', 'MathJax 3'], ['mathjax2', 'MathJax 2']]),
      field('katex_cdn_url', 'KaTeX 资源目录（留空使用本地资源）', 'url'),
      field('mathjax_cdn_url', 'MathJax 3 脚本', 'url'),
      field('mathjax_v2_cdn_url', 'MathJax 2 脚本', 'url'),
      enabled('enable_lazyload', '图片延迟加载', true),
      number('lazyload_threshold', '图片提前加载距离（px）', '800', 0, 2500, 1),
      select('lazyload_effect', '图片载入动画', 'fadeIn', [['fadeIn', '淡入'], ['slideDown', '下滑'], ['none', '关闭']]),
      select('lazyload_loading_style', '图片加载占位动画', '1', [
        ...Array.from({ length: 11 }, (_, index) => [String(index + 1), '加载动画 ' + (index + 1)] as const), ['none', '关闭'],
      ]),
      enabled('enable_fancybox', '正文图片灯箱', true),
      enabled('enable_zoomify', '点击图片放大'),
      number('zoomify_duration', '放大动画时长（毫秒）', '200', 0, 10000, 1),
      field('zoomify_easing', '放大动画缓动', 'text', 'cubic-bezier(0.4,0,0,1)'),
      number('zoomify_scale', '放大后占用视口比例', '0.9', .01, 1, .01),
      select('enable_pangu', '中英文间距', 'false', panguChoices),
      enabled('home_show_shuoshuo', '首页展示说说', true),
      enabled('fold_long_shuoshuo', '折叠较长的说说'),
      enabled('first_image_as_thumbnail_by_default', '用首图作为默认封面'),
      enabled('hide_shortcode_in_preview', '摘要隐藏短代码', true),
      number('trim_words_count', '摘要长度（字/词）', '95', 0, 1000, 1),
      field('hide_categories', '首页排除的分类 ID（逗号分隔）'),
      enabled('archives_timeline_show_month', '归档时间线显示月份', true),
      select('related_post', '相关文章', 'disabled', [['disabled', '隐藏'], ['category', '同分类'], ['tag', '同标签'], ['category,tag', '同分类或标签']]),
      number('related_post_limit', '相关文章数量', '10', 1, 100, 1),
      select('related_post_sort_order', '相关文章时间顺序', 'DESC', [['DESC', '从新到旧'], ['ASC', '从旧到新']]),
      select('related_post_sort_orderby', '相关文章排序依据', 'date', [
        ['date', '发布时间'], ['modified', '修改时间'], ['meta_value_num', '浏览量'], ['ID', 'ID'], ['title', '标题'], ['author', '作者'], ['rand', '随机'],
      ]),
      select('show_sharebtn', '文章分享', 'domestic', [['false', '关闭'], ['domestic', '国内平台'], ['abroad', '国外平台'], ['true', '全部平台']]),
      field('donate_qrcode_url', '打赏二维码图片', 'url'),
      field('additional_content_after_post', '正文后附加 HTML', 'html'),
      field('reference_list_title', '引用列表标题', 'text', '参考'),
      number('outdated_info_days', '文章过时提示天数（−1 关闭）', '-1', -1, 99999, 1),
      select('outdated_info_time_type', '过时提示依据', 'modifiedtime', [['modifiedtime', '修改时间'], ['createdtime', '发布时间']]),
      select('outdated_info_tip_type', '过时提示位置', 'inpost', [['inpost', '正文顶部'], ['toast', '右上角提示']]),
      field('outdated_info_tip_content', '过时提示文案（%date_delta% 为天数）', 'text', '本文最后更新于 %date_delta% 天前。'),
      field('seo_description', '站点 SEO 描述'),
      field('seo_keywords', '站点 SEO 关键词'),
    ],
  },
  {
    title: '导航与浮动按钮',
    fields: [
      enabled('pjax_disabled', '关闭无刷新导航'),
      enabled('disable_pjax_animation', '关闭导航切换动画'),
      enabled('enable_into_article_animation', '正文进入动画'),
      enabled('enable_login_css', '站主登录使用 Argon 登录样式'),
      enabled('enable_timezone_fix', '按访问设备时区显示日期时间'),
      select('enable_smoothscroll_type', '平滑滚动', 'disabled', [
        ['disabled', '关闭'], ['1', '方案 1'], ['1_pulse', '方案 1（脉冲）'], ['2', '方案 2'], ['3', '方案 3'],
      ]),
      select('enable_headroom', '顶栏滚动行为', 'false', [['false', '固定悬浮'], ['true', '向下滚动时折叠'], ['absolute', '随页面滚动']]),
      field('toolbar_title', '顶栏标题'),
      field('toolbar_icon', '顶栏图标地址', 'url'),
      field('toolbar_icon_link', '顶栏图标链接', 'url'),
      enabled('enable_search_filters', '搜索结果可按内容类型筛选', true),
      field('search_filters_type', '搜索类型（逗号分隔，* 表示默认选中）', 'text', '*post,*page,shuoshuo'),
      enabled('fab_show_darkmode_button', '显示夜间模式按钮'),
      enabled('fab_show_gotocomment_button', '显示跳转评论按钮'),
      enabled('fab_show_settings_button', '显示访客主题设置按钮', true),
      enabled('show_customize_theme_color_picker', '允许访客选择主题色'),
    ],
  },
  {
    title: '静态资源',
    fields: [
      select('assets_path', '主题资源地址', 'default', [
        ['default', '本站'], ['jsdelivr', 'jsDelivr'], ['jsdelivr_gcore', 'jsDelivr Gcore'], ['jsdelivr_fastly', 'jsDelivr Fastly'],
        ['jsdelivr_cf', 'jsDelivr Cloudflare'], ['fastgit', 'FastGit'], ['sourcegcdn', 'Source Global CDN'], ['custom', '自定义'],
      ]),
      field('custom_assets_path', 'Argon 资源根目录（支持 %theme_version%）', 'url'),
    ],
  },
  {
    title: '评论与留言',
    fields: [
      enabled('comment_allow_editing', '允许访客修改自己的留言'),
      enabled('comment_allow_markdown', '允许 Markdown 排版'),
      enabled('comment_emotion_keyboard', '表情与贴纸键盘'),
      enabled('enable_comment_pinning', '允许站主置顶留言'),
      enabled('enable_comment_upvote', '允许留言点赞'),
      enabled('show_comment_parent_info', '显示回复对象'),
      enabled('comment_allow_privatemode', '允许悄悄话'),
      enabled('comment_need_captcha', '启用留言计算题验证'),
      enabled('get_captcha_by_ajax', '打开留言表单时获取验证题'),
      enabled('hide_name_email_site_input', '隐藏昵称、邮箱和网站输入'),
      enabled('comment_enable_qq_avatar', '允许显示 QQ 头像'),
      enabled('text_gravatar', '使用姓名首字头像'),
      field('gravatar_cdn', 'Gravatar 镜像地址', 'url'),
      enabled('comment_avatar_vcenter', '头像垂直居中'),
      enabled('fold_long_comments', '折叠较长的评论'),
      select('comment_pagination_type', '留言分页', 'feed', [['feed', '继续加载'], ['page', '页码']]),
      select('comment_ua', '留言设备信息', 'hidden', [
        ['hidden', '隐藏'], ['browser', '浏览器'], ['browser,version', '浏览器和版本'], ['platform', '系统'],
        ['platform,browser', '系统和浏览器'], ['platform,browser,version', '系统、浏览器和版本'],
      ]),
      select('who_can_visit_comment_edit_history', '可查看编辑历史的用户', 'admin', [
        ['admin', '站主'], ['commentsender', '发送者与站主'], ['everyone', '所有访客'],
      ]),
      enabled('comment_allow_mailnotice', '允许订阅留言回复通知'),
      enabled('comment_mailnotice_checkbox_checked', '默认勾选回复通知'),
    ],
  },
  {
    title: '页脚与自定义样式',
    fields: [field('footer_html', '页脚 HTML', 'html'), enabled('hide_footer_author', '隐藏 Argon 作者名'),
      field('custom_html_head', '页面头部 HTML', 'html'), field('custom_html_foot', '页面底部 HTML', 'html'),
      field('custom_css', '自定义 CSS', 'css')],
  },
];

export type ArgonOptions = Record<string, string | boolean | number>;

const aliases: Record<string, Record<string, string>> = {
  argon_banner_size: { default: 'full' },
  argon_page_background_banner_style: { default: 'false' },
  argon_article_header_style: { default: 'article-header-style-default' },
  argon_math_render: { none: 'false' },
};

function normalize(key: string, value: string) {
  if (['argon_katex_cdn_url', 'argon_mathjax_cdn_url', 'argon_mathjax_v2_cdn_url', 'argon_gravatar_cdn'].includes(key) && value.startsWith('//')) return 'https:' + value;
  return aliases[key]?.[value] ?? value;
}

export function option(overrides: Record<string, string>, base: ArgonOptions, name: string, fallback = '') {
  const key = 'argon_' + name;
  const value = overrides[key] ?? base[key];
  return value === undefined || value === null || value === '' ? fallback : normalize(key, String(value));
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

export function headHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ['meta', 'link'],
    allowedAttributes: { meta: ['name', 'property', 'content'], link: ['rel', 'href', 'media', 'type', 'sizes'] },
    allowedSchemes: ['https'],
    allowProtocolRelative: false,
    exclusiveFilter: ({ tag, attribs }) => tag === 'link' && !['stylesheet', 'preconnect', 'dns-prefetch', 'icon', 'alternate'].includes(attribs.rel),
  });
}

export function customHtml(name: 'custom_html_head' | 'custom_html_foot', value: string) {
  return name === 'custom_html_head' ? headHtml(value) : footerHtml(value);
}

export function validateOptions(raw: Record<string, unknown>) {
  const settings: Record<string, string> = {};
  for (const group of optionGroups) {
    for (const item of group.fields) {
      const key = 'argon_' + item.key;
      if (!Object.hasOwn(raw, key)) continue;
      const input = raw[key];
      if (!['string', 'boolean', 'number'].includes(typeof input)) throw new Error(item.label + '的格式不正确。');
      const value = normalize(key, String(input).trim());
      const numberValue = Number(value);
      const metadata = value.split('|').filter(Boolean);
      const validSearchTypes = item.key !== 'search_filters_type' ||
        /^\*?(post|page|shuoshuo)(\s*,\s*\*?(post|page|shuoshuo)){0,2}$/.test(value);
      const validExcludedCategories = item.key !== 'hide_categories' || !value || /^\d+(\s*,\s*\d+)*$/.test(value);
      const validEasing = item.key !== 'zoomify_easing' || /^(linear|ease(?:-in|-out|-in-out)?|cubic-bezier\([\d.,\s-]+\))$/.test(value);
      const valid = value.length <= (item.type === 'html' || item.type === 'css' ? 16384 : 2048) && (
        item.type === 'select' ? item.choices?.some(([choice]) => choice === value) :
        item.type === 'color' ? /^#[\da-f]{6}$/i.test(value) :
        item.type === 'url' ? ((item.key === 'banner_background_url' && value === '--bing--') || validUrl(value)) :
        item.type === 'number' ? value !== '' && Number.isFinite(numberValue) && numberValue >= item.min! && numberValue <= item.max! :
        item.type === 'metadata' ? metadata.every((entry) => metadataChoices.some(([choice]) => choice === entry)) :
        item.type === 'css' ? !/<\/style/i.test(value) :
        validSearchTypes && validExcludedCategories && validEasing
      );
      if (!valid) throw new Error(item.label + '的值不在允许范围内。');
      settings[key] = item.type === 'metadata' ? [...new Set(metadata)].join('|')
        : item.type === 'html' ? (item.key === 'custom_html_head' ? headHtml(value) : footerHtml(value)) : value;
    }
  }
  return settings;
}
