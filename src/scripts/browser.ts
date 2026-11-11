import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { colorPalette } from '../lib/color';

type Preferences = Partial<Record<'mode' | 'font' | 'shadow' | 'filter' | 'radius' | 'color', string>>;
const key = 'argon-astro-prefs';
const system = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let bannerTimer: number | undefined;
let scrollQueued = false;
let highlightLoading: Promise<void> | undefined;

function preferences(): Preferences {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function applyPreferences() {
  const root = document.documentElement;
  const settings = preferences();
  const mode = settings.mode ?? root.dataset.mode;
  const dark = ['dark', 'black', 'alwayson'].includes(mode ?? '') ||
    (mode === 'system' && system.matches) ||
    (mode === 'time' && (new Date().getHours() >= 19 || new Date().getHours() < 7));
  root.classList.toggle('darkmode', dark);
  root.classList.toggle('amoled-dark', mode === 'black');
  root.dataset.selectedFont = settings.font ?? root.dataset.font;
  root.dataset.selectedShadow = settings.shadow ?? root.dataset.shadow;
  root.dataset.filter = settings.filter ?? 'off';
  const radius = Number(settings.radius ?? root.dataset.radius);
  if (Number.isFinite(radius) && radius >= 0 && radius <= 30) root.style.setProperty('--card-radius', radius + 'px');
  const color = settings.color ?? root.dataset.color ?? '';
  if (/^#[\da-f]{6}$/i.test(color)) {
    for (const [name, value] of Object.entries(colorPalette(color))) root.style.setProperty(name, value);
  }
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-pref]').forEach((field) => {
    const name = field.name as keyof Preferences;
    field.value = settings[name] ?? (name === 'mode' ? (mode === 'alwayson' ? 'dark' : (mode === 'system' ? mode : 'light')) : root.dataset[name] ?? field.value);
  });
}

function savePreference(name: keyof Preferences, value: string) {
  try { localStorage.setItem(key, JSON.stringify({ ...preferences(), [name]: value })); } catch { return; }
  applyPreferences();
}

function updateScroll() {
  scrollQueued = false;
  const y = scrollY;
  const bar = document.getElementById('navbar-main');
  const cover = document.getElementById('banner');
  const max = Math.max(110, (cover?.offsetHeight ?? 180) * .6);
  const alpha = Math.min(.93, y / max * .93);
  bar?.classList.toggle('navbar-ontop', y < 8);
  bar?.style.setProperty('--argon-scroll-alpha', String(alpha));
  const control = document.getElementById('fabtn_back_to_top');
  control?.classList.toggle('argon-fab-hidden', y < 160);
  const article = document.getElementById('post_content');
  if (article) {
    const rect = article.getBoundingClientRect();
    const progress = Math.max(0, Math.min(100, Math.round((innerHeight - rect.top) / Math.max(1, rect.height) * 100)));
    const label = document.getElementById('fabtn_reading_progress_details');
    const indicator = document.getElementById('fabtn_reading_progress_bar');
    if (label) label.textContent = progress + '%';
    if (indicator) indicator.style.height = progress + '%';
  }
}

function queueScroll() {
  if (!scrollQueued) {
    scrollQueued = true;
    requestAnimationFrame(updateScroll);
  }
}

function updateClocks() {
  const uptime = document.getElementById('blog_running_time');
  const started = Date.parse(document.documentElement.dataset.startedAt ?? '');
  if (uptime && Number.isFinite(started)) {
    const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
    uptime.textContent = Math.floor(seconds / 86400) + ' 天 ' + Math.floor(seconds % 86400 / 3600) + ' 时 ' +
      Math.floor(seconds % 3600 / 60) + ' 分 ' + seconds % 60 + ' 秒';
  }
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const pct = (now.getTime() - start) / (end - start) * 100;
  const name = document.getElementById('yearprogress_yearname');
  const short = document.getElementById('yearprogress_progresstext');
  const full = document.getElementById('yearprogress_progresstext_full');
  const bar = document.getElementById('yearprogress_progressbar');
  if (name) name.textContent = String(year);
  if (short) short.textContent = pct.toFixed(2) + '%';
  if (full) full.textContent = pct.toFixed(7) + '%';
  if (bar) bar.style.width = pct + '%';
}

function bannerTyping() {
  clearTimeout(bannerTimer);
  if (reducedMotion.matches || sessionStorage.getItem('argon-banner-played')) return;
  const target = document.querySelector<HTMLElement>('[data-type-banner]');
  if (!target) return;
  const elements = [...target.querySelectorAll<HTMLElement>('.banner-title-inner, .banner-subtitle')];
  const originals = elements.map((element) => Array.from(element.textContent ?? ''));
  elements.forEach((element) => { element.textContent = '\u00a0'; });
  sessionStorage.setItem('argon-banner-played', '1');
  let row = 0;
  let col = 0;
  function step() {
    const letters = originals[row];
    if (!letters) return;
    if (col < letters.length) {
      elements[row].textContent = letters.slice(0, ++col).join('');
    } else {
      row += 1;
      col = 0;
    }
    bannerTimer = window.setTimeout(step, Number(target?.dataset.typeBanner) || 100);
  }
  step();
}

function spaceChinese(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('pre, code, textarea, script, style, .katex')) continue;
    node.textContent = (node.textContent ?? '').replace(/(\p{Script=Han})([\p{Script=Latin}\d])/gu, '$1 $2')
      .replace(/([\p{Script=Latin}\d])(\p{Script=Han})/gu, '$1 $2');
  }
}

function setMedia(element: HTMLElement) {
  element.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const original = img.dataset.original ?? img.dataset.src ?? img.dataset.lazySrc;
    if (original && !img.getAttribute('src')?.startsWith('/wp-content/uploads/')) img.src = original;
    img.loading = 'lazy';
    if (document.documentElement.dataset.zoom === 'true' && !img.closest('a,button')) {
      img.classList.add('astro-zoom');
      img.tabIndex = 0;
    }
  });
}

async function highlight() {
  const blocks = [...document.querySelectorAll<HTMLElement>('[data-article] pre code:not(.hljs)')];
  if (!blocks.length || document.documentElement.dataset.highlight !== 'true') return;
  type Highlighter = { highlightBlock(element: HTMLElement): void };
  const host = window as typeof window & { hljs?: Highlighter };
  if (!host.hljs) {
    highlightLoading ??= new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = '/assets/argon/highlight.js';
      script.onload = script.onerror = () => resolve();
      document.head.append(script);
    });
    await highlightLoading;
  }
  blocks.filter((block) => block.isConnected).forEach((block) => host.hljs?.highlightBlock(block));
}

function initPage() {
  applyPreferences();
  updateScroll();
  updateClocks();
  try { bannerTyping(); } catch { /* Storage can be disabled. */ }
  const root = document.documentElement;
  document.querySelectorAll<HTMLElement>('[data-article]').forEach((element) => {
    setMedia(element);
    const pangu = root.dataset.pangu?.split('|') ?? [];
    const kind = element.classList.contains('comment-item-text') ? 'comment'
      : element.classList.contains('shuoshuo-content') ? 'shuoshuo' : 'article';
    if (pangu.includes(kind)) spaceChinese(element);
    if (root.dataset.katex === 'true' && !element.dataset.mathRendered) {
      renderMathInElement(element, { delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ], throwOnError: false });
      element.dataset.mathRendered = 'true';
    }
  });
  void highlight();
}

function drawer(open: boolean) {
  document.documentElement.classList.toggle('leftbar-opened', open);
  document.getElementById('open_sidebar')?.setAttribute('aria-expanded', String(open));
}

function openImage(img: HTMLImageElement) {
  const dialog = document.querySelector<HTMLDialogElement>('#argon_image_preview');
  const target = dialog?.querySelector('img');
  if (!dialog || !target) return;
  target.src = img.currentSrc || img.src;
  target.alt = img.alt;
  dialog.showModal();
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const target = event.target;
  const reply = target.closest<HTMLElement>('[data-reply-id]');
  const cancelReply = target.closest('[data-comment-reply-cancel]');
  if (reply || cancelReply) {
    const parent = document.querySelector<HTMLInputElement>('[data-comment-parent]');
    const info = document.querySelector<HTMLElement>('[data-comment-reply-info]');
    const name = document.querySelector<HTMLElement>('[data-comment-reply-name]');
    if (parent && info && name) {
      parent.value = reply?.dataset.replyId ?? '0';
      info.hidden = !reply;
      name.textContent = reply?.dataset.replyAuthor ?? '';
      if (reply) document.getElementById('post_comment_content')?.focus();
    }
    return;
  }
  const opener = target.closest<HTMLElement>('[data-open-dialog]');
  if (opener) {
    event.preventDefault();
    document.getElementById(opener.dataset.openDialog ?? '') instanceof HTMLDialogElement &&
      (document.getElementById(opener.dataset.openDialog ?? '') as HTMLDialogElement).showModal();
    return;
  }
  const dialog = target.closest<HTMLDialogElement>('dialog');
  if (dialog && (target === dialog || target.closest('[data-close-dialog]'))) {
    dialog.close();
    return;
  }
  if (target.closest('#open_sidebar')) drawer(!document.documentElement.classList.contains('leftbar-opened'));
  if (target.closest('#sidebar_mask, #leftbar a:not([data-sidebar-tab])')) drawer(false);
  const tab = target.closest<HTMLElement>('[data-sidebar-tab]');
  if (tab) {
    event.preventDefault();
    document.querySelectorAll<HTMLElement>('[data-sidebar-tab]').forEach((item) => {
      item.setAttribute('aria-selected', String(item === tab));
      item.classList.toggle('active', item === tab);
      item.classList.toggle('show', item === tab);
      const panel = document.getElementById('leftbar_tab_' + item.dataset.sidebarTab);
      panel?.classList.toggle('active', item === tab);
      panel?.classList.toggle('show', item === tab);
    });
  }
  const behavior = reducedMotion.matches ? 'instant' : 'smooth';
  if (target.closest('[data-back-top]')) window.scrollTo({ top: 0, behavior });
  if (target.closest('[data-scroll-content]')) document.getElementById('content')?.scrollIntoView({ behavior });
  if (target.closest('[data-toggle-dark]')) savePreference('mode', document.documentElement.classList.contains('darkmode') ? 'light' : 'dark');
  if (target instanceof HTMLImageElement && target.classList.contains('astro-zoom')) openImage(target);
  const copy = target.closest<HTMLButtonElement>('[data-copy-link]');
  if (copy) {
    void navigator.clipboard.writeText(location.href.split('#')[0]).then(() => {
      const old = copy.innerHTML;
      copy.textContent = '已复制';
      setTimeout(() => { if (copy.isConnected) copy.innerHTML = old; }, 1500);
    }).catch(() => { copy.textContent = '请复制地址栏链接'; });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') drawer(false);
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLImageElement && event.target.classList.contains('astro-zoom')) {
    event.preventDefault();
    openImage(event.target);
  }
});
document.addEventListener('change', (event) => {
  const target = event.target;
  if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.hasAttribute('data-pref')) {
    savePreference(target.name as keyof Preferences, target.value);
  }
});
document.addEventListener('astro:before-preparation', () => { document.documentElement.classList.add('argon-loading'); });
document.addEventListener('astro:after-swap', applyPreferences);
document.addEventListener('astro:page-load', () => {
  document.documentElement.classList.remove('argon-loading');
  initPage();
});
window.addEventListener('scroll', queueScroll, { passive: true });
window.addEventListener('resize', queueScroll);
system.addEventListener('change', applyPreferences);
window.setInterval(updateClocks, 1000);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('meta[name="astro-view-transitions-enabled"]')) initPage();
  }, { once: true });
} else if (!document.querySelector('meta[name="astro-view-transitions-enabled"]')) initPage();
