const sections = [
  ['global', '全局', 'theme_color show_customize_theme_color_picker enable_immersion_color darkmode_autoswitch enable_amoled_dark card_radius card_shadow page_layout article_list_waterflow article_list_layout font assets_path custom_assets_path dateformat'],
  ['toolbar', '顶栏', 'enable_headroom toolbar_title toolbar_icon toolbar_icon_link toolbar_blur'],
  ['banner', '顶部 Banner（封面）', 'banner_title banner_subtitle banner_size page_background_banner_style show_toolbar_mask banner_background_url banner_background_color_type banner_background_hide_shapes enable_banner_title_typing_effect banner_typing_effect_interval'],
  ['background', '页面背景', 'page_background_url page_background_dark_url page_background_opacity'],
  ['sidebar', '左侧栏', 'sidebar_banner_title sidebar_banner_subtitle sidebar_auther_name sidebar_auther_image sidebar_author_description'],
  ['announcement', '博客公告', 'sidebar_announcement'],
  ['buttons', '浮动操作按钮', 'fab_show_settings_button fab_show_darkmode_button fab_show_gotocomment_button'],
  ['seo', 'SEO', 'seo_description seo_keywords'],
  ['articles', '文章', 'article_meta show_readingtime reading_speed reading_speed_en reading_speed_code show_thumbnail_in_banner_in_content_page first_image_as_thumbnail_by_default reference_list_title show_sharebtn show_headindex_number donate_qrcode_url additional_content_after_post related_post related_post_sort_orderby related_post_sort_order related_post_limit article_header_style outdated_info_time_type outdated_info_days outdated_info_tip_type outdated_info_tip_content'],
  ['archive', '归档页面', 'archives_timeline_show_month archives_timeline_url'],
  ['footer', '页脚', 'footer_html'],
  ['highlight', '代码高亮', 'enable_code_highlight code_theme code_highlight_hide_linenumber code_highlight_break_line code_highlight_transparent_linenumber'],
  ['math', '数学公式', 'math_render mathjax_cdn_url mathjax_v2_cdn_url katex_cdn_url'],
  ['lazyload', 'Lazyload', 'enable_lazyload lazyload_threshold lazyload_effect lazyload_loading_style'],
  ['images', '图片放大浏览', 'enable_fancybox enable_zoomify zoomify_duration zoomify_easing zoomify_scale'],
  ['pangu', 'Pangu.js', 'enable_pangu'],
  ['scripts', '脚本与样式', 'custom_html_head custom_html_foot custom_css'],
  ['motion', '动画', 'enable_smoothscroll_type enable_into_article_animation disable_pjax_animation'],
  ['comments', '评论', 'comment_pagination_type comment_emotion_keyboard hide_name_email_site_input comment_need_captcha get_captcha_by_ajax comment_allow_markdown comment_allow_editing comment_allow_privatemode comment_allow_mailnotice comment_mailnotice_checkbox_checked comment_enable_qq_avatar comment_avatar_vcenter who_can_visit_comment_edit_history enable_comment_pinning enable_comment_upvote comment_ua show_comment_parent_info fold_long_comments gravatar_cdn text_gravatar'],
  ['search', '搜索', 'enable_search_filters search_filters_type'],
  ['other', '杂项', 'pjax_disabled hide_categories enable_login_css home_show_shuoshuo fold_long_shuoshuo enable_timezone_fix hide_shortcode_in_preview trim_words_count enable_mobile_scale disable_googlefont disable_codeblock_style hide_footer_author'],
];

const previewFields = new Set(['page_layout', 'article_list_waterflow', 'article_list_layout']);

function settingRow(label, control, key) {
  const title = document.createElement('span');
  title.className = 'argon-setting-title';
  title.textContent = [...label.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent.trim()).filter(Boolean).join(' ');

  const field = document.createElement('span');
  field.className = 'argon-setting-field';
  if (!(control instanceof HTMLSelectElement) || !previewFields.has(key)) {
    field.append(...label.children);
    label.className = 'argon-setting-row';
    label.removeAttribute('style');
    label.replaceChildren(title, field);
    return label;
  }

  const row = document.createElement('div');
  row.className = 'argon-setting-row';
  title.id = control.name + '-label';
  field.classList.add('argon-setting-previews');
  field.setAttribute('role', 'radiogroup');
  field.setAttribute('aria-labelledby', title.id);
  for (const choice of control.options) {
    const option = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = control.name;
    radio.value = choice.value;
    radio.checked = choice.selected;
    const preview = document.createElement('span');
    preview.className = 'argon-layout-preview';
    preview.dataset.setting = key;
    preview.dataset.value = choice.value;
    preview.setAttribute('aria-hidden', 'true');
    preview.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    option.append(radio, preview, document.createTextNode(choice.label));
    field.append(option);
  }
  row.append(title, field);
  return row;
}

const shell = document.querySelector('main.admin-shell');
const form = shell?.querySelector('form:has(.fields)');
const nav = shell?.querySelector('.admin-nav');
const save = form?.querySelector('.save-bar');
const backup = shell?.querySelector('#backup');

if (form && nav && save && backup) {
  const originalSections = [...form.querySelectorAll('.admin-section')];
  const fields = new Map();
  for (const label of form.querySelectorAll('.fields > label')) {
    const control = label.querySelector('[name^="argon_"]');
    if (control) fields.set(control.name.slice(6), { label, control });
  }

  if (fields.size > 0) {
    const commentNotice = originalSections.find((section) => section.querySelector('[name="argon_comment_allow_mailnotice"]'))?.querySelector('p');
    const heading = shell.querySelector('h1');
    if (heading) heading.textContent = 'Argon 主题选项';
    const navigation = document.createDocumentFragment();
    let index = 0;
    for (const [id, title, keys] of sections) {
      const rows = [];
      const names = keys.split(' ');
      if (id === 'other') names.push(...fields.keys());
      for (const key of names) {
        const field = fields.get(key);
        if (!field) continue;
        rows.push(settingRow(field.label, field.control, key));
        fields.delete(key);
      }
      if (!rows.length) continue;
      const section = document.createElement('section');
      section.id = 'argon-option-' + id;
      const subtitle = document.createElement('h2');
      subtitle.textContent = title;
      section.className = 'admin-section';
      section.append(subtitle);
      if (id === 'comments' && commentNotice) section.append(commentNotice);
      section.append(...rows);
      save.before(section);
      const link = document.createElement('a');
      link.href = '#' + section.id;
      link.textContent = title;
      navigation.append(link);
      index += 1;
    }
    if (index) {
      const link = document.createElement('a');
      link.href = '#backup';
      link.textContent = '导入与导出';
      nav.replaceChildren(navigation, link);
      originalSections.forEach((section) => section.remove());
      shell.classList.add('argon-options-ready');
    }
  }
}
